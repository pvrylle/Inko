import { createEmptyCard, fsrs, Rating, type Card } from "ts-fsrs";
import type { Flashcard, StudyRating } from "@/lib/data/models";

export type FsrsSchedule = Pick<
  Flashcard,
  "due" | "stability" | "difficulty" | "elapsed_days" | "scheduled_days" | "learning_steps" | "reps" | "lapses" | "state" | "last_review"
>;

const scheduler = fsrs();

export const fsrsRating = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const satisfies Record<StudyRating, Rating>;

function serializeFsrsCard(card: Card): FsrsSchedule {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString() ?? null,
  };
}

export function createInitialFsrsState(now: Date = new Date()): FsrsSchedule {
  return serializeFsrsCard(createEmptyCard(now));
}

export function toFsrsCard(card: Pick<Flashcard, keyof FsrsSchedule>): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  } as Card;
}

export function scheduleFlashcard(
  card: Pick<Flashcard, keyof FsrsSchedule>,
  rating: StudyRating,
  reviewedAt: Date = new Date(),
): FsrsSchedule {
  return serializeFsrsCard(scheduler.next(toFsrsCard(card), reviewedAt, fsrsRating[rating]).card);
}
