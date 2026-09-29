"use client";

import { Brain, CheckCircle2, Sparkles, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { useMascot } from "@/features/mascot/mascot-provider";
import { generateNoteFromContent } from "@/features/notes/notes-repository";
import { useNotes } from "@/features/notes/use-notes";
import { PageVoiceControl } from "@/features/voice/page-voice-control";
import { usesLocalStudyData } from "@/lib/data/local-study";
import { upsertLocalRecord } from "@/lib/data/local-store";
import type { Note, QuizAnswerResult } from "@/lib/data/models";
import { topicToNote } from "@/lib/study/topic-note";
import { generateQuiz, submitQuizAnswer } from "./quizzes-repository";
import { useQuizzes } from "./use-quizzes";

const optionLetters = ["A", "B", "C", "D"];

export function QuizzesView() {
  const { notes, loading: notesLoading } = useNotes();
  const { quizzes, questions, attempts, loading, error, reload, userId } = useQuizzes();
  const { celebrate, dispatch } = useMascot();
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [topic, setTopic] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [result, setResult] = useState<QuizAnswerResult | null>(null);
  const [working, setWorking] = useState<"generate" | "answer" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const activeNoteId = selectedNoteId || notes[0]?.id || "";
  const selectedNote = notes.find((note) => note.id === activeNoteId) ?? null;
  const activeQuizId = selectedQuizId || quizzes[0]?.id || "";
  const activeQuiz = quizzes.find((quiz) => quiz.id === activeQuizId) ?? null;
  const activeQuestions = useMemo(() => questions.filter((question) => question.quiz_id === activeQuizId).sort((a, b) => a.position - b.position), [activeQuizId, questions]);
  const activeAttempts = useMemo(() => attempts.filter((attempt) => attempt.quiz_id === activeQuizId), [activeQuizId, attempts]);
  const attemptedIds = useMemo(() => new Set(activeAttempts.map((attempt) => attempt.question_id)), [activeAttempts]);
  const resultQuestion = result ? activeQuestions.find((question) => question.id === result.attempt.question_id) ?? null : null;
  const currentQuestion = resultQuestion ?? activeQuestions.find((question) => !attemptedIds.has(question.id)) ?? null;
  const score = activeAttempts.filter((attempt) => attempt.correct).length;
  const complete = Boolean(activeQuiz && activeQuestions.length > 0 && activeAttempts.length === activeQuestions.length && !result);

  const resolveNote = async (): Promise<Note | null> => {
    const prompt = topic.trim();
    if (prompt.length >= 8 && userId) {
      if (await usesLocalStudyData()) {
        const note = topicToNote(userId, prompt);
        upsertLocalRecord("notes", userId, note);
        return note;
      }
      return generateNoteFromContent(userId, prompt);
    }
    return selectedNote ?? null;
  };

  const createQuiz = async () => {
    if (!userId) return;
    setWorking("generate");
    setFormError(null);
    try {
      const note = await resolveNote();
      if (!note) {
        setFormError("Choose a note or type a topic of at least 8 characters.");
        return;
      }
      const generated = await generateQuiz(userId, note);
      setSelectedQuizId(generated.quiz.id);
      setSelectedOption(null);
      setResult(null);
      await reload();
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "QUIZ_GENERATION_FAILED";
      setFormError(code === "GUEST_LIMIT" ? "You've used today's guest study limit. Sign in to keep going." : code === "GEMINI_NOT_CONFIGURED" ? "Add GEMINI_API_KEY to generate quizzes with Inko." : code === "SUPABASE_SECRET_KEY_REQUIRED" ? "Add SUPABASE_SECRET_KEY so Inko can protect quiz answer keys." : "Inko couldn't make that quiz. Please try again.");
    } finally {
      setWorking(null);
    }
  };

  const submitAnswer = async () => {
    if (!userId || !currentQuestion || selectedOption === null || result) return;
    setWorking("answer");
    setFormError(null);
    try {
      const answerResult = await submitQuizAnswer(userId, currentQuestion, selectedOption);
      setResult(answerResult);
      await reload();
      if (answerResult.attempt.correct) celebrate("You got it!");
      else dispatch({ type: "ENCOURAGE", message: "Good try — use the explanation and keep going." });
    } catch {
      setFormError("That answer wasn't saved. Please try once more.");
    } finally {
      setWorking(null);
    }
  };

  const nextQuestion = () => {
    setResult(null);
    setSelectedOption(null);
    setFormError(null);
  };

  const chooseQuiz = (quizId: string) => {
    setSelectedQuizId(quizId);
    setSelectedOption(null);
    setResult(null);
    setFormError(null);
  };

  return (
    <div className="content-page page-enter">
      <PageHeading eyebrow="Test your understanding" title="Quiz with Inko" description="Four choices, one grounded answer, and no peeking before you commit." action={<PageVoiceControl />} />

      <section className="quiz-generator" aria-label="Generate a quiz">
        <div><span><Sparkles size={19} /></span><div><h2>Build from a note or topic</h2><p>Answer keys stay private until each attempt is submitted.</p></div></div>
        <div className="quiz-generator-controls">
          {!notesLoading && notes.length > 0 && (
            <label><span className="sr-only">Source note</span><select onChange={(event) => setSelectedNoteId(event.target.value)} value={activeNoteId}>{notes.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label>
          )}
          <label className="topic-field">
            <span className="sr-only">Study topic</span>
            <input onChange={(event) => setTopic(event.target.value)} placeholder="Or type a topic, e.g. cellular respiration" value={topic} />
          </label>
          <button className="secondary-button" disabled={working !== null} onClick={() => void createQuiz()}>{working === "generate" ? "Building quiz…" : "Generate quiz"}</button>
        </div>
      </section>

      {quizzes.length > 1 && (
        <label className="quiz-picker">Quiz deck<select onChange={(event) => chooseQuiz(event.target.value)} value={activeQuizId}>{quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}</select></label>
      )}
      {(error || formError) && <p className="form-error quiz-error" role="alert">{formError || error}</p>}

      {!loading && quizzes.length === 0 ? (
        <EmptyState icon={Brain} title="What should I quiz you on?" message="Choose a note or type a topic above and Inko will create a focused multiple-choice challenge." />
      ) : complete && activeQuiz ? (
        <section className="quiz-complete" aria-live="polite">
          <span><Trophy size={28} /></span><p className="eyebrow">Quiz complete</p><h2>{score} of {activeQuestions.length} correct</h2>
          <p>{score === activeQuestions.length ? "A perfect round — those ideas are clicking." : "Nice work. Review the tricky ideas, then generate another round when you're ready."}</p>
          <button className="secondary-button" onClick={() => void createQuiz()}><Sparkles size={17} /> Try a fresh quiz</button>
        </section>
      ) : activeQuiz && currentQuestion ? (
        <section className="quiz-session" aria-label={activeQuiz.title}>
          <div className="quiz-session-heading"><div><span className="note-source">{activeQuiz.title}</span><h2>Question {currentQuestion.position + 1} of {activeQuestions.length}</h2></div><strong>{score} of {activeQuestions.length} correct</strong></div>
          <div aria-label="Quiz progress" aria-valuemax={activeQuestions.length} aria-valuemin={0} aria-valuenow={Math.min(activeAttempts.length + (result ? 0 : 1), activeQuestions.length)} className="quiz-progress" role="progressbar"><span style={{ width: `${Math.max(8, ((activeAttempts.length + (result ? 0 : 1)) / activeQuestions.length) * 100)}%` }} /></div>
          <article className="quiz-question">
            <p>{currentQuestion.prompt}</p>
            <div className="quiz-options" role="radiogroup" aria-label="Answer choices">
              {currentQuestion.options.map((option, index) => {
                const optionResult = result ? index === result.correct_index ? "correct" : index === result.attempt.selected_index ? "incorrect" : "neutral" : "neutral";
                return <button aria-checked={selectedOption === index} role="radio" key={`${currentQuestion.id}:${index}`} className="quiz-option" data-result={optionResult} data-selected={selectedOption === index} disabled={Boolean(result) || working !== null} onClick={() => setSelectedOption(index)}><span>{optionLetters[index]}</span><strong>{option}</strong>{result && index === result.correct_index && <CheckCircle2 size={18} />}</button>;
              })}
            </div>
          </article>

          {result ? (
            <div className="quiz-feedback" data-correct={result.attempt.correct} aria-live="polite">
              <div><strong>{result.attempt.correct ? "Correct" : "Not quite"}</strong><p>{result.attempt.feedback}</p></div>
              <button className="primary-button" onClick={nextQuestion}>{activeAttempts.length === activeQuestions.length ? "See results" : "Next question"}</button>
            </div>
          ) : (
            <button className="primary-button large quiz-submit" disabled={selectedOption === null || working !== null} onClick={() => void submitAnswer()}>{working === "answer" ? "Checking…" : "Submit answer"}</button>
          )}
        </section>
      ) : null}
    </div>
  );
}
