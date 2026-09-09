import { describe, expect, it } from "vitest";
import { Rating, State } from "ts-fsrs";
import { createInitialFsrsState, fsrsRating, scheduleFlashcard } from "./fsrs";

describe("FSRS persistence mapping", () => {
  it("initializes a new card at the requested instant", () => {
    const now = new Date("2026-09-09T10:00:00.000Z");
    expect(createInitialFsrsState(now)).toEqual({
      due: now.toISOString(),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: State.New,
      last_review: null,
    });
  });

  it("maps every confirmed study rating to FSRS", () => {
    expect(fsrsRating).toEqual({ again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy });
  });

  it("serializes the next FSRS card after a review", () => {
    const createdAt = new Date("2026-09-09T10:00:00.000Z");
    const reviewedAt = new Date("2026-09-09T10:05:00.000Z");
    const next = scheduleFlashcard(createInitialFsrsState(createdAt), "good", reviewedAt);
    expect(next.reps).toBe(1);
    expect(next.last_review).toBe(reviewedAt.toISOString());
    expect(new Date(next.due).getTime()).toBeGreaterThan(reviewedAt.getTime());
    expect(next.state).not.toBe(State.New);
  });
});
