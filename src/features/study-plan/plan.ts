import type { ProgressSummary } from "@/features/progress/progress-summary";

export type StudyPlanStep = {
  id: "review-cards" | "run-quiz" | "capture-note" | "start-focus" | "celebrate";
  title: string;
  detail: string;
  minutes: number;
  href: "/flashcards" | "/quiz" | "/library" | "/focus" | "/progress";
};

export type StudyPlanInputs = {
  dueCards: number;
  notesCount: number;
  quizzesCount: number;
  hasOpenFocus: boolean;
  summary: ProgressSummary;
};

export type StudyPlan = {
  steps: StudyPlanStep[];
  headline: string;
  encouragement: string;
  totalMinutes: number;
};

export function buildStudyPlan({ dueCards, notesCount, quizzesCount, hasOpenFocus, summary }: StudyPlanInputs): StudyPlan {
  const steps: StudyPlanStep[] = [];
  if (dueCards > 0) {
    const minutes = Math.min(20, Math.max(5, Math.round(dueCards * 0.6)));
    steps.push({
      id: "review-cards",
      title: `Review ${dueCards} due card${dueCards === 1 ? "" : "s"}`,
      detail: dueCards >= 12 ? "Warm up your recall before anything else." : "A quick recall sprint keeps memory strong.",
      minutes,
      href: "/flashcards",
    });
  } else if (notesCount === 0) {
    steps.push({
      id: "capture-note",
      title: "Capture your first note",
      detail: "Say what you are learning and I'll shape it into a note you can reuse.",
      minutes: 6,
      href: "/library",
    });
  }

  if (notesCount > 0 && quizzesCount === 0) {
    steps.push({
      id: "run-quiz",
      title: "Try a grounded quiz",
      detail: "Test how well the ideas actually stuck.",
      minutes: 8,
      href: "/quiz",
    });
  } else if (quizzesCount > 0 && (summary.quizAccuracy ?? 100) < 70) {
    steps.push({
      id: "run-quiz",
      title: "Sharpen quiz accuracy",
      detail: "Answer a quick round to strengthen the weakest ideas.",
      minutes: 8,
      href: "/quiz",
    });
  }

  if (!hasOpenFocus) {
    const focusMinutes = summary.today.focusMinutes >= 25 ? 15 : 25;
    steps.push({
      id: "start-focus",
      title: `Focus for ${focusMinutes} minutes`,
      detail: hasOpenFocus ? "Return to your open session." : summary.today.focusMinutes ? "Layer another block onto today's momentum." : "Settle into a single task and let the timer run.",
      minutes: focusMinutes,
      href: "/focus",
    });
  }

  if (steps.length === 0) {
    steps.push({
      id: "celebrate",
      title: "You are ahead of the plan",
      detail: "Take a break or peek at your progress and celebrate a bit.",
      minutes: 4,
      href: "/progress",
    });
  }

  const headline = dueCards > 0 ? "Start with the cards that are ripe" : notesCount === 0 ? "Every study loop starts with a note" : "Aim for one focused block";
  const encouragement = summary.streak >= 3 ? `You're on a ${summary.streak}-day streak — keep the glow going.` : summary.streak === 1 ? "Nice, day one. Consistency compounds." : "Small starts count. Pick one step and begin.";
  const totalMinutes = steps.reduce((total, step) => total + step.minutes, 0);
  return { steps, headline, encouragement, totalMinutes };
}
