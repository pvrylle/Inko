import { describe, expect, it } from "vitest";
import { buildProgressSummary, calculateActivityStreak } from "./progress-summary";

describe("progress summary", () => {
  it("calculates a UTC streak ending today or yesterday", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    expect(calculateActivityStreak(["2026-09-09T01:00:00Z", "2026-09-08T23:00:00Z", "2026-09-07T08:00:00Z"], now)).toBe(3);
    expect(calculateActivityStreak(["2026-09-08T23:00:00Z", "2026-09-07T08:00:00Z"], now)).toBe(2);
  });

  it("aggregates reviews, quiz accuracy, focus minutes, and recent activity", () => {
    const summary = buildProgressSummary(
      [{ id: "r1", reviewed_at: "2026-09-09T10:00:00Z" }],
      [{ id: "q1", created_at: "2026-09-09T11:00:00Z", correct: true }, { id: "q2", created_at: "2026-09-09T11:01:00Z", correct: false }],
      [{ id: "f1", completed_at: "2026-09-09T09:00:00Z", duration_minutes: 25, status: "completed" }],
      new Date("2026-09-09T12:00:00Z"),
    );
    expect(summary).toMatchObject({ streak: 1, cardsReviewed: 1, quizCorrect: 1, quizTotal: 2, quizAccuracy: 50, focusMinutes: 25, completedFocusSessions: 1, averageFocusMinutes: 25 });
    expect(summary.recent).toHaveLength(4);
  });

  it("uses null accuracy when no quiz has been attempted", () => {
    expect(buildProgressSummary([], [], []).quizAccuracy).toBeNull();
  });

  it("returns a 7-day heatmap ending on today with per-kind counts", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    const summary = buildProgressSummary(
      [{ id: "r1", reviewed_at: "2026-09-09T10:00:00Z" }, { id: "r2", reviewed_at: "2026-09-08T10:00:00Z" }],
      [{ id: "q1", created_at: "2026-09-09T11:00:00Z", correct: true }],
      [{ id: "f1", completed_at: "2026-09-09T09:00:00Z", duration_minutes: 25, status: "completed" }],
      now,
    );
    expect(summary.weekly).toHaveLength(7);
    expect(summary.weekly[6]).toMatchObject({ date: "2026-09-09", cards: 1, quiz: 1, focus: 25 });
    expect(summary.weekly[5]).toMatchObject({ date: "2026-09-08", cards: 1, quiz: 0, focus: 0 });
  });

  it("captures today totals separately from lifetime totals", () => {
    const summary = buildProgressSummary(
      [{ id: "r1", reviewed_at: "2026-09-09T10:00:00Z" }, { id: "r2", reviewed_at: "2026-09-06T10:00:00Z" }],
      [{ id: "q1", created_at: "2026-09-09T11:00:00Z", correct: true }],
      [{ id: "f1", completed_at: "2026-09-09T09:00:00Z", duration_minutes: 25, status: "completed" }, { id: "f2", completed_at: "2026-09-06T09:00:00Z", duration_minutes: 45, status: "completed" }],
      new Date("2026-09-09T12:00:00Z"),
    );
    expect(summary.today).toEqual({ cardsReviewed: 1, quizCorrect: 1, quizTotal: 1, focusMinutes: 25 });
    expect(summary.cardsReviewed).toBe(2);
    expect(summary.focusMinutes).toBe(70);
    expect(summary.averageFocusMinutes).toBe(35);
  });

  it("marks achievements as achieved once thresholds are met", () => {
    const now = new Date("2026-09-09T12:00:00Z");
    const reviews = Array.from({ length: 12 }, (_, index) => ({ id: `r${index}`, reviewed_at: "2026-09-09T10:00:00Z" }));
    const summary = buildProgressSummary(reviews, [], [], now);
    const firstSteps = summary.achievements.find((achievement) => achievement.id === "first-steps");
    expect(firstSteps?.achieved).toBe(true);
    expect(firstSteps?.progress).toBe(10);
  });
});
