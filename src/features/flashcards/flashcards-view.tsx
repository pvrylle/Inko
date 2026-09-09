"use client";

import { BookOpen, Brain, CalendarClock, CheckCircle2, Flame, Layers3, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useNotes } from "@/features/notes/use-notes";
import { useToasts } from "@/features/toast/toast-provider";
import type { Flashcard, SemanticGrade, StudyRating } from "@/lib/data/models";
import { commitFlashcardReview, generateFlashcards, gradeFlashcardAnswer } from "./flashcards-repository";
import { useFlashcards } from "./use-flashcards";

const ratings: { value: StudyRating; label: string; hint: string }[] = [
  { value: "again", label: "Again", hint: "Forgot" },
  { value: "hard", label: "Hard", hint: "Major effort" },
  { value: "good", label: "Good", hint: "Recalled" },
  { value: "easy", label: "Easy", hint: "Effortless" },
];

function nextDueDescription(card: Flashcard, now: number) {
  const diffMs = Date.parse(card.due) - now;
  if (diffMs <= 0) return "Due now";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `Due in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Due in ${hours}h`;
  const days = Math.round(hours / 24);
  return `Due in ${days}d`;
}

export function FlashcardsView() {
  const { notes, loading: notesLoading } = useNotes();
  const { flashcards, loading, error, reload, userId } = useFlashcards();
  const { celebrate: mascotCelebrate, dispatch } = useMascot();
  const { celebrate } = useToasts();
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<SemanticGrade | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [activeCardKey, setActiveCardKey] = useState<string | null>(null);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [working, setWorking] = useState<"generate" | "grade" | "review" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewClock, setReviewClock] = useState(() => Date.now());
  const [todayEndsAt] = useState(() => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  });

  useEffect(() => {
    const interval = window.setInterval(() => setReviewClock(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const dueCards = useMemo(() => flashcards.filter((card) => Date.parse(card.due) <= reviewClock), [flashcards, reviewClock]);
  const upcomingCards = useMemo(
    () => flashcards.filter((card) => Date.parse(card.due) > reviewClock).sort((a, b) => Date.parse(a.due) - Date.parse(b.due)).slice(0, 4),
    [flashcards, reviewClock],
  );
  const activeCard = dueCards[0] ?? null;
  const activeNoteId = selectedNoteId || notes[0]?.id || "";
  const selectedNote = notes.find((note) => note.id === activeNoteId) ?? null;
  const dueToday = flashcards.filter((card) => Date.parse(card.due) <= todayEndsAt).length;
  const learning = flashcards.filter((card) => card.state === 1 || card.state === 3).length;
  const mastered = flashcards.filter((card) => card.state === 2 && card.stability >= 21).length;
  const masteredPercent = flashcards.length ? Math.round((mastered / flashcards.length) * 100) : 0;

  if ((activeCard?.id ?? null) !== activeCardKey) {
    setActiveCardKey(activeCard?.id ?? null);
    if (flipped) setFlipped(false);
  }

  const createCards = async () => {
    if (!userId || !selectedNote) return;
    setWorking("generate");
    setFormError(null);
    try {
      const generatedCards = await generateFlashcards(userId, selectedNote);
      await reload();
      setReviewClock((current) => Math.max(current, ...generatedCards.map((card) => Date.parse(card.due))));
      mascotCelebrate("Your new cards are ready!");
      celebrate("Deck ready", `${generatedCards.length} card${generatedCards.length === 1 ? "" : "s"} from ${selectedNote.title}`);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "FLASHCARD_GENERATION_FAILED";
      setFormError(code === "GEMINI_NOT_CONFIGURED" ? "Add GEMINI_API_KEY to generate flashcards with Inko." : "Inko couldn't make those cards. Please try again.");
    } finally {
      setWorking(null);
    }
  };

  const checkAnswer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || !activeCard || !answer.trim()) return;
    setWorking("grade");
    setFormError(null);
    try {
      const nextGrade = await gradeFlashcardAnswer(userId, activeCard, answer);
      setGrade(nextGrade);
      setFlipped(true);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "FLASHCARD_GRADING_FAILED";
      setFormError(code === "GEMINI_NOT_CONFIGURED" ? "Add GEMINI_API_KEY for semantic answer feedback." : "Inko couldn't check that answer. Please try again.");
    } finally {
      setWorking(null);
    }
  };

  const confirmRating = async (rating: StudyRating) => {
    if (!userId || !activeCard) return;
    setWorking("review");
    setFormError(null);
    try {
      const result = await commitFlashcardReview(userId, activeCard, rating, answer, grade);
      setAnswer("");
      setGrade(null);
      setFlipped(false);
      await reload();
      setReviewClock(Date.parse(result.review.reviewed_at));
      if (rating === "good" || rating === "easy") {
        const nextStreak = sessionStreak + 1;
        setSessionStreak(nextStreak);
        mascotCelebrate(rating === "easy" ? "That one is sticking!" : "Nice recall!");
        if (nextStreak > 0 && nextStreak % 5 === 0) celebrate("Five in a row", "That is what fluency starts to feel like.");
      } else {
        setSessionStreak(0);
        dispatch({ type: "ENCOURAGE", message: rating === "again" ? "No worries — we'll see it again soon." : "Effort builds memory." });
      }
    } catch {
      setFormError("That review wasn't saved. Your schedule has not been advanced.");
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="content-page page-enter">
      <PageHeading eyebrow="Remember for longer" title="Flashcards" description="Inko checks meaning, then you choose the rating that advances your private FSRS schedule." />

      <div className="stat-strip" aria-label="Flashcard statistics">
        <span><strong>{dueToday}</strong><small>Due today</small></span>
        <span><strong>{learning}</strong><small>Learning</small></span>
        <span><strong>{mastered}</strong><small>Mastered</small></span>
      </div>

      {flashcards.length > 0 && (
        <div className="mastery-ring" role="progressbar" aria-label="Mastered percentage" aria-valuenow={masteredPercent} aria-valuemin={0} aria-valuemax={100} style={{ ["--mastery-progress" as string]: `${masteredPercent}%` }}>
          <div>
            <strong>{masteredPercent}%</strong>
            <small>Mastered</small>
          </div>
        </div>
      )}

      {!notesLoading && notes.length > 0 && (
        <section className="deck-generator" aria-label="Create a flashcard deck">
          <div><span className="deck-generator-icon"><Sparkles size={19} /></span><div><h2>Make cards from a note</h2><p>Gemini finds the most useful ideas for active recall.</p></div></div>
          <div className="deck-generator-controls">
            <label><span className="sr-only">Source note</span><select onChange={(event) => setSelectedNoteId(event.target.value)} value={activeNoteId}>{notes.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label>
            <button className="secondary-button" disabled={working !== null} onClick={() => void createCards()}>{working === "generate" ? "Making cards…" : "Generate cards"}</button>
          </div>
        </section>
      )}

      {(error || formError) && <p className="form-error flashcard-error" role="alert">{formError || error}</p>}

      {!loading && notes.length === 0 ? (
        <EmptyState icon={BookOpen} title="Create a note first" message="Flashcards stay grounded in your notes, so Inko never invents facts for your deck." />
      ) : !loading && flashcards.length === 0 ? (
        <EmptyState icon={Layers3} title="No cards yet" message="Choose a note above and Inko will turn its key ideas into an active-recall deck." />
      ) : !loading && !activeCard ? (
        <EmptyState icon={CheckCircle2} title="You are caught up" message="Nothing is due right now. FSRS will bring each idea back when reviewing helps most." />
      ) : activeCard ? (
        <section className="review-session" aria-label="Flashcard review">
          <div className="review-progress">
            <span><Brain size={17} /> Review queue</span>
            <div className="review-progress-meta">
              {sessionStreak > 1 && <span className="streak-chip"><Flame size={13} /> {sessionStreak} in a row</span>}
              <strong>{dueCards.length} due now</strong>
            </div>
          </div>
          <div className="flashcard-flip" data-flipped={flipped}>
            <article className="flashcard-face flashcard-front" aria-hidden={flipped}>
              <span className="card-side-label">Question</span>
              <h2>{activeCard.front}</h2>
              <button className="flip-hint" onClick={() => setFlipped(true)} type="button"><RotateCcw size={13} /> Peek at the answer</button>
            </article>
            <article className="flashcard-face flashcard-back" aria-hidden={!flipped}>
              <span className="card-side-label">Answer</span>
              <p>{activeCard.back}</p>
              {activeCard.explanation && <small>{activeCard.explanation}</small>}
              <button className="flip-hint" onClick={() => setFlipped(false)} type="button"><RotateCcw size={13} /> Back to question</button>
            </article>
          </div>

          {!grade ? (
            <form className="answer-form" onSubmit={checkAnswer}>
              <label htmlFor="flashcard-answer">Answer in your own words</label>
              <textarea autoFocus id="flashcard-answer" onChange={(event) => setAnswer(event.target.value)} placeholder="Type or say what you remember…" rows={4} value={answer} />
              <button className="primary-button large" disabled={working !== null || answer.trim().length === 0}>{working === "grade" ? "Checking meaning…" : "Check answer"}</button>
            </form>
          ) : (
            <div className="grade-panel" data-verdict={grade.verdict}>
              <div className="grade-summary"><strong>{Math.round(grade.score * 100)}%</strong><div><span>{grade.verdict === "correct" ? "Correct" : grade.verdict === "partial" ? "Nearly there" : "Keep building"}</span><p>{grade.feedback}</p></div></div>
              <p className="rating-prompt">Inko suggests <strong>{grade.suggested_rating}</strong>. Confirm how recall felt to schedule the card:</p>
              <div className="rating-grid">
                {ratings.map((rating) => <button key={rating.value} className="rating-button" data-suggested={grade.suggested_rating === rating.value} disabled={working !== null} onClick={() => void confirmRating(rating.value)}><strong>{rating.label}</strong><small>{rating.hint}</small></button>)}
              </div>
              <button className="answer-retry" disabled={working !== null} onClick={() => { setGrade(null); setFlipped(false); }}>Edit my answer</button>
            </div>
          )}
        </section>
      ) : null}

      {upcomingCards.length > 0 && (
        <section className="upcoming-cards" aria-label="Upcoming reviews">
          <div className="section-title-row">
            <div><p className="eyebrow">Coming up</p><h2>Next reviews</h2></div>
            <span className="upcoming-meta"><CalendarClock size={14} /> FSRS scheduled</span>
          </div>
          <ol className="upcoming-list">
            {upcomingCards.map((card) => (
              <li key={card.id}>
                <span className="upcoming-front">{card.front}</span>
                <span className="upcoming-due">{nextDueDescription(card, reviewClock)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
