import { inkoFetch } from "@/lib/auth/api-client";
import { readLocalCollection, subscribeToLocalCollection, upsertLocalRecord } from "@/lib/data/local-store";
import type { Flashcard, FlashcardReview, Note, SemanticGrade, StudyRating } from "@/lib/data/models";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export async function listFlashcards(userId: string) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return readLocalCollection<Flashcard>("flashcards", userId).sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  const { data, error } = await supabase.from("flashcards").select("*").order("due", { ascending: true });
  if (error) throw error;
  return data as Flashcard[];
}

export async function generateFlashcards(userId: string, note: Note) {
  const isDemo = !getBrowserSupabaseClient();
  const response = await inkoFetch("/api/study/flashcards/generate", {
    method: "POST",
    body: JSON.stringify({ note_id: note.id, note: isDemo ? note : undefined, callId: crypto.randomUUID() }),
  });
  const payload = (await response.json()) as { cards?: Flashcard[]; persisted?: boolean; error?: string };
  if (!response.ok || !payload.cards) throw new Error(payload.error || "FLASHCARD_GENERATION_FAILED");
  if (!payload.persisted) payload.cards.forEach((card) => upsertLocalRecord("flashcards", userId, card));
  return payload.cards;
}

export async function gradeFlashcardAnswer(userId: string, card: Flashcard, answer: string) {
  const isDemo = !getBrowserSupabaseClient();
  const response = await inkoFetch("/api/study/flashcards/grade", {
    method: "POST",
    body: JSON.stringify({ card_id: card.id, card: isDemo ? card : undefined, answer, callId: crypto.randomUUID() }),
  });
  const payload = (await response.json()) as { grade?: SemanticGrade; error?: string };
  if (!response.ok || !payload.grade) throw new Error(payload.error || "FLASHCARD_GRADING_FAILED");
  return payload.grade;
}

export async function commitFlashcardReview(
  userId: string,
  card: Flashcard,
  rating: StudyRating,
  answer: string,
  grade: SemanticGrade | null,
) {
  const isDemo = !getBrowserSupabaseClient();
  const response = await inkoFetch("/api/study/flashcards/review", {
    method: "POST",
    body: JSON.stringify({
      card_id: card.id,
      card: isDemo ? card : undefined,
      rating,
      answer,
      semantic_score: grade?.score,
      feedback: grade?.feedback,
      callId: crypto.randomUUID(),
    }),
  });
  const payload = (await response.json()) as { card?: Flashcard; review?: FlashcardReview; persisted?: boolean; error?: string };
  if (!response.ok || !payload.card || !payload.review) throw new Error(payload.error || "FLASHCARD_REVIEW_FAILED");
  if (!payload.persisted) {
    upsertLocalRecord("flashcards", userId, payload.card);
    upsertLocalRecord("reviews", userId, payload.review);
  }
  return { card: payload.card, review: payload.review, persisted: payload.persisted ?? false };
}

export function subscribeToFlashcards(userId: string, onChange: () => void) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return subscribeToLocalCollection("flashcards", userId, onChange);
  const channel = supabase
    .channel(`flashcards:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "flashcards", filter: `owner_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
