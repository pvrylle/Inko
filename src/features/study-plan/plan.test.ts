import { describe, expect, it } from "vitest";
import { emptyProgressSummary } from "@/features/progress/progress-summary";
import { buildStudyPlan } from "./plan";

describe("buildStudyPlan", () => {
  it("prioritizes due cards when any are due", () => {
    const plan = buildStudyPlan({ dueCards: 6, notesCount: 3, quizzesCount: 1, hasOpenFocus: false, summary: emptyProgressSummary });
    expect(plan.steps[0].id).toBe("review-cards");
    expect(plan.totalMinutes).toBeGreaterThan(0);
  });

  it("prompts a note capture when the library is empty", () => {
    const plan = buildStudyPlan({ dueCards: 0, notesCount: 0, quizzesCount: 0, hasOpenFocus: false, summary: emptyProgressSummary });
    expect(plan.steps[0].id).toBe("capture-note");
  });

  it("celebrates when there is nothing to do", () => {
    const plan = buildStudyPlan({ dueCards: 0, notesCount: 4, quizzesCount: 2, hasOpenFocus: true, summary: { ...emptyProgressSummary, quizAccuracy: 90 } });
    expect(plan.steps.at(-1)?.id).toBe("celebrate");
  });

  it("suggests focus with 25 minutes when today has none logged", () => {
    const plan = buildStudyPlan({ dueCards: 0, notesCount: 2, quizzesCount: 0, hasOpenFocus: false, summary: emptyProgressSummary });
    const focusStep = plan.steps.find((step) => step.id === "start-focus");
    expect(focusStep?.minutes).toBe(25);
  });
});
