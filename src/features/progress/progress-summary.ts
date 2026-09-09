export type ReviewMetric = { id: string; reviewed_at: string };
export type QuizMetric = { id: string; created_at: string; correct: boolean };
export type FocusMetric = { id: string; completed_at: string | null; duration_minutes: number; status: string };

export type ProgressActivity = { id: string; kind: "cards" | "quiz" | "focus"; label: string; occurredAt: string };
export type ProgressAchievement = {
  id: "first-steps" | "consistent" | "marathoner" | "sharpshooter" | "focused-friend";
  label: string;
  description: string;
  achieved: boolean;
  progress: number;
  target: number;
};
export type ProgressHeatmapDay = { date: string; count: number; cards: number; quiz: number; focus: number };
export type ProgressTodayTotals = { cardsReviewed: number; quizCorrect: number; quizTotal: number; focusMinutes: number };
export type ProgressSummary = {
  streak: number;
  cardsReviewed: number;
  quizCorrect: number;
  quizTotal: number;
  quizAccuracy: number | null;
  focusMinutes: number;
  completedFocusSessions: number;
  averageFocusMinutes: number;
  today: ProgressTodayTotals;
  weekly: ProgressHeatmapDay[];
  achievements: ProgressAchievement[];
  recent: ProgressActivity[];
};

function utcDay(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function utcDayIso(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function calculateActivityStreak(activityDates: string[], now: Date = new Date()): number {
  const days = new Set(activityDates.map(utcDay));
  let cursor = utcDay(now);
  if (!days.has(cursor)) cursor -= 86_400_000;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 86_400_000;
  }
  return streak;
}

function buildHeatmap(reviews: ReviewMetric[], attempts: QuizMetric[], focus: FocusMetric[], now: Date): ProgressHeatmapDay[] {
  const today = utcDay(now);
  const days: ProgressHeatmapDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const dayMs = today - offset * 86_400_000;
    const iso = utcDayIso(dayMs);
    const cards = reviews.filter((review) => utcDay(review.reviewed_at) === dayMs).length;
    const quiz = attempts.filter((attempt) => utcDay(attempt.created_at) === dayMs).length;
    const focusMinutes = focus.filter((session) => session.completed_at && utcDay(session.completed_at) === dayMs).reduce((total, session) => total + session.duration_minutes, 0);
    days.push({ date: iso, count: cards + quiz + (focusMinutes > 0 ? 1 : 0), cards, quiz, focus: focusMinutes });
  }
  return days;
}

function buildAchievements(cards: number, quizCorrect: number, quizTotal: number, focusMinutes: number, streak: number): ProgressAchievement[] {
  const accuracy = quizTotal ? Math.round((quizCorrect / quizTotal) * 100) : 0;
  return [
    { id: "first-steps", label: "First steps", description: "Review your first ten flashcards.", achieved: cards >= 10, progress: Math.min(cards, 10), target: 10 },
    { id: "consistent", label: "Consistent", description: "Study on seven different days in a row.", achieved: streak >= 7, progress: Math.min(streak, 7), target: 7 },
    { id: "marathoner", label: "Marathoner", description: "Complete 300 focus minutes.", achieved: focusMinutes >= 300, progress: Math.min(focusMinutes, 300), target: 300 },
    { id: "sharpshooter", label: "Sharpshooter", description: "Reach 80% quiz accuracy across at least 10 answers.", achieved: quizTotal >= 10 && accuracy >= 80, progress: Math.min(accuracy, 80), target: 80 },
    { id: "focused-friend", label: "Focused friend", description: "Finish three focus sessions in one week.", achieved: false, progress: 0, target: 3 },
  ];
}

export function buildProgressSummary(reviews: ReviewMetric[], attempts: QuizMetric[], focusSessions: FocusMetric[], now: Date = new Date()): ProgressSummary {
  const completedFocus = focusSessions.filter((session) => session.status === "completed" && session.completed_at);
  const activityDates = [
    ...reviews.map((review) => review.reviewed_at),
    ...attempts.map((attempt) => attempt.created_at),
    ...completedFocus.map((session) => session.completed_at as string),
  ];
  const quizCorrect = attempts.filter((attempt) => attempt.correct).length;
  const focusMinutes = completedFocus.reduce((total, session) => total + session.duration_minutes, 0);
  const streak = calculateActivityStreak(activityDates, now);
  const weekly = buildHeatmap(reviews, attempts, completedFocus, now);
  const weeklyFocusSessions = completedFocus.filter((session) => session.completed_at && utcDay(session.completed_at) >= utcDay(now) - 6 * 86_400_000).length;
  const achievements = buildAchievements(reviews.length, quizCorrect, attempts.length, focusMinutes, streak).map((achievement) =>
    achievement.id === "focused-friend"
      ? { ...achievement, achieved: weeklyFocusSessions >= 3, progress: Math.min(weeklyFocusSessions, 3) }
      : achievement,
  );

  const today = utcDay(now);
  const todayTotals: ProgressTodayTotals = {
    cardsReviewed: reviews.filter((review) => utcDay(review.reviewed_at) === today).length,
    quizCorrect: attempts.filter((attempt) => attempt.correct && utcDay(attempt.created_at) === today).length,
    quizTotal: attempts.filter((attempt) => utcDay(attempt.created_at) === today).length,
    focusMinutes: completedFocus.filter((session) => session.completed_at && utcDay(session.completed_at) === today).reduce((total, session) => total + session.duration_minutes, 0),
  };

  const recent: ProgressActivity[] = [
    ...reviews.map((review) => ({ id: `review:${review.id}`, kind: "cards" as const, label: "Reviewed a flashcard", occurredAt: review.reviewed_at })),
    ...attempts.map((attempt) => ({ id: `quiz:${attempt.id}`, kind: "quiz" as const, label: attempt.correct ? "Answered a quiz question correctly" : "Practiced a quiz question", occurredAt: attempt.created_at })),
    ...completedFocus.map((session) => ({ id: `focus:${session.id}`, kind: "focus" as const, label: `Completed ${session.duration_minutes} minutes of focus`, occurredAt: session.completed_at as string })),
  ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 6);

  return {
    streak,
    cardsReviewed: reviews.length,
    quizCorrect,
    quizTotal: attempts.length,
    quizAccuracy: attempts.length ? Math.round((quizCorrect / attempts.length) * 100) : null,
    focusMinutes,
    completedFocusSessions: completedFocus.length,
    averageFocusMinutes: completedFocus.length ? Math.round(focusMinutes / completedFocus.length) : 0,
    today: todayTotals,
    weekly,
    achievements,
    recent,
  };
}

export const emptyProgressSummary: ProgressSummary = {
  streak: 0,
  cardsReviewed: 0,
  quizCorrect: 0,
  quizTotal: 0,
  quizAccuracy: null,
  focusMinutes: 0,
  completedFocusSessions: 0,
  averageFocusMinutes: 0,
  today: { cardsReviewed: 0, quizCorrect: 0, quizTotal: 0, focusMinutes: 0 },
  weekly: [],
  achievements: [],
  recent: [],
};
