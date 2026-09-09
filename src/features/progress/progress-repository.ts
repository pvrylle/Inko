import { readLocalCollection, subscribeToLocalCollection } from "@/lib/data/local-store";
import type { FlashcardReview, FocusSession, QuizAttempt } from "@/lib/data/models";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { buildProgressSummary, type FocusMetric, type ProgressSummary, type QuizMetric, type ReviewMetric } from "./progress-summary";

export async function loadProgress(userId: string): Promise<ProgressSummary> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    const reviews = readLocalCollection<FlashcardReview>("reviews", userId).map(({ id, reviewed_at }) => ({ id, reviewed_at }));
    const attempts = readLocalCollection<QuizAttempt>("quiz-attempts", userId).map(({ id, created_at, correct }) => ({ id, created_at, correct }));
    const focus = readLocalCollection<FocusSession>("focus-sessions", userId).map(({ id, completed_at, duration_minutes, status }) => ({ id, completed_at, duration_minutes, status }));
    return buildProgressSummary(reviews, attempts, focus);
  }

  const [reviews, attempts, focus] = await Promise.all([
    supabase.from("flashcard_reviews").select("id,reviewed_at"),
    supabase.from("quiz_attempts").select("id,created_at,correct"),
    supabase.from("focus_sessions").select("id,completed_at,duration_minutes,status"),
  ]);
  if (reviews.error || attempts.error || focus.error) throw reviews.error || attempts.error || focus.error;
  return buildProgressSummary(reviews.data as ReviewMetric[], attempts.data as QuizMetric[], focus.data as FocusMetric[]);
}

export function subscribeToProgress(userId: string, onChange: () => void) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    const stops = [
      subscribeToLocalCollection("reviews", userId, onChange),
      subscribeToLocalCollection("quiz-attempts", userId, onChange),
      subscribeToLocalCollection("focus-sessions", userId, onChange),
    ];
    return () => stops.forEach((stop) => stop());
  }
  const channel = supabase
    .channel(`progress:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "flashcard_reviews", filter: `owner_id=eq.${userId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts", filter: `owner_id=eq.${userId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "focus_sessions", filter: `owner_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
