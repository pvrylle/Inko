import { inkoFetch } from "@/lib/auth/api-client";
import { usesLocalStudyData } from "@/lib/data/local-study";
import { readLocalCollection, subscribeToLocalCollection, upsertLocalRecord } from "@/lib/data/local-store";
import type { Note, Quiz, QuizAnswerKey, QuizAnswerResult, QuizAttempt, QuizQuestion } from "@/lib/data/models";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export type QuizData = { quizzes: Quiz[]; questions: QuizQuestion[]; attempts: QuizAttempt[] };

function localQuizData(userId: string): QuizData {
  return {
    quizzes: readLocalCollection<Quiz>("quizzes", userId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    questions: readLocalCollection<QuizQuestion>("quiz-questions", userId),
    attempts: readLocalCollection<QuizAttempt>("quiz-attempts", userId),
  };
}

export async function listQuizData(userId: string): Promise<QuizData> {
  if (await usesLocalStudyData()) return localQuizData(userId);
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return localQuizData(userId);
  const [quizzes, questions, attempts] = await Promise.all([
    supabase.from("quizzes").select("*").order("created_at", { ascending: false }),
    supabase.from("quiz_questions").select("*").order("position", { ascending: true }),
    supabase.from("quiz_attempts").select("*").order("created_at", { ascending: true }),
  ]);
  if (quizzes.error || questions.error || attempts.error) throw quizzes.error || questions.error || attempts.error;
  return { quizzes: quizzes.data as Quiz[], questions: questions.data as QuizQuestion[], attempts: attempts.data as QuizAttempt[] };
}

export async function generateQuiz(userId: string, note: Note) {
  const local = await usesLocalStudyData();
  const response = await inkoFetch("/api/study/quizzes/generate", {
    method: "POST",
    body: JSON.stringify({ note_id: note.id, note: local ? note : undefined, callId: crypto.randomUUID() }),
  });
  const payload = (await response.json()) as { quiz?: Quiz; questions?: QuizQuestion[]; demo_answer_keys?: QuizAnswerKey[]; persisted?: boolean; error?: string };
  if (!response.ok || !payload.quiz || !payload.questions) throw new Error(payload.error || "QUIZ_GENERATION_FAILED");
  if (!payload.persisted || local) {
    upsertLocalRecord("quizzes", userId, payload.quiz);
    payload.questions.forEach((question) => upsertLocalRecord("quiz-questions", userId, question));
    payload.demo_answer_keys?.forEach((key) => upsertLocalRecord("quiz-answer-keys", userId, key));
  }
  return { quiz: payload.quiz, questions: payload.questions };
}

export async function submitQuizAnswer(userId: string, question: QuizQuestion, selectedIndex: number): Promise<QuizAnswerResult> {
  const local = await usesLocalStudyData();
  const answerKey = local ? readLocalCollection<QuizAnswerKey>("quiz-answer-keys", userId).find((key) => key.question_id === question.id) : undefined;
  const existingAttempt = local ? readLocalCollection<QuizAttempt>("quiz-attempts", userId).find((attempt) => attempt.question_id === question.id) : undefined;
  const response = await inkoFetch("/api/study/quizzes/answer", {
    method: "POST",
    body: JSON.stringify({ question_id: question.id, selected_index: selectedIndex, question: local ? question : undefined, answer_key: answerKey, existing_attempt: existingAttempt }),
  });
  const payload = (await response.json()) as Partial<QuizAnswerResult> & { error?: string };
  if (!response.ok || !payload.attempt || payload.correct_index === undefined) throw new Error(payload.error || "QUIZ_ANSWER_FAILED");
  if (!payload.persisted || local) upsertLocalRecord("quiz-attempts", userId, payload.attempt);
  return { attempt: payload.attempt, correct_index: payload.correct_index, persisted: payload.persisted ?? false };
}

export function subscribeToQuizzes(userId: string, onChange: () => void) {
  const unsubscribe = ["quizzes", "quiz-questions", "quiz-attempts"].map((collection) => subscribeToLocalCollection(collection as "quizzes" | "quiz-questions" | "quiz-attempts", userId, onChange));
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return () => unsubscribe.forEach((stop) => stop());
  const channel = supabase
    .channel(`quizzes:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "quizzes", filter: `owner_id=eq.${userId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "quiz_questions", filter: `owner_id=eq.${userId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts", filter: `owner_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => {
    unsubscribe.forEach((stop) => stop());
    void supabase.removeChannel(channel);
  };
}
