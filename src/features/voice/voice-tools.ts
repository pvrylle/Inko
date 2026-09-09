"use client";

import { inkoFetch } from "@/lib/auth/api-client";
import { readLocalCollection, upsertLocalRecord } from "@/lib/data/local-store";
import type { Flashcard, FlashcardReview, FocusSession, Note, Quiz, QuizAnswerKey, QuizAttempt, QuizQuestion } from "@/lib/data/models";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { buildProgressSummary, type FocusMetric, type QuizMetric, type ReviewMetric } from "@/features/progress/progress-summary";
import { buildStudyPlan } from "@/features/study-plan/plan";
import type { ToolCall } from "./voice-types";

const toolEndpoints: Record<string, string> = {
  create_note: "/api/study/notes/generate",
  generate_flashcards: "/api/study/flashcards/generate",
  start_flashcard_review: "/api/study/flashcards/next",
  grade_flashcard_answer: "/api/study/flashcards/grade",
  commit_flashcard_rating: "/api/study/flashcards/review",
  start_quiz: "/api/study/quizzes/generate",
  submit_quiz_answer: "/api/study/quizzes/answer",
  start_focus_session: "/api/study/focus/start",
  control_focus_timer: "/api/study/focus/control",
  plan_study_session: "/api/study/plan",
};

function getDemoIdentity() {
  if (getBrowserSupabaseClient()) return null;
  return window.localStorage.getItem("inko.demo-user-id");
}

function enrichDemoArguments(call: ToolCall) {
  const userId = getDemoIdentity();
  const args = { ...call.arguments } as Record<string, unknown>;
  if (!userId) return args;

  if (call.name === "generate_flashcards" || call.name === "start_quiz") {
    const noteId = args.note_id;
    args.note = readLocalCollection<Note>("notes", userId).find((note) => note.id === noteId);
  }
  if (call.name === "grade_flashcard_answer" || call.name === "commit_flashcard_rating") {
    const cardId = args.card_id;
    args.card = readLocalCollection<Flashcard>("flashcards", userId).find((card) => card.id === cardId);
  }
  if (call.name === "submit_quiz_answer") {
    const questionId = args.question_id;
    args.question = readLocalCollection<QuizQuestion>("quiz-questions", userId).find((question) => question.id === questionId);
    args.answer_key = readLocalCollection<QuizAnswerKey>("quiz-answer-keys", userId).find((key) => key.question_id === questionId);
    args.existing_attempt = readLocalCollection<QuizAttempt>("quiz-attempts", userId).find((attempt) => attempt.question_id === questionId);
  }
  if (call.name === "start_focus_session" || call.name === "control_focus_timer") {
    args.current_session = readLocalCollection<FocusSession>("focus-sessions", userId).find((session) => session.status === "active" || session.status === "paused");
  }
  return args;
}

function startDemoReview(userId: string) {
  const cards = readLocalCollection<Flashcard>("flashcards", userId);
  const dueCards = cards.filter((card) => Date.parse(card.due) <= Date.now()).sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  const card = dueCards[0];
  return {
    card: card ? { id: card.id, note_id: card.note_id, front: card.front, due: card.due, reps: card.reps } : null,
    due_count: dueCards.length,
  };
}

function summarizeDemoProgress(userId: string) {
  const reviews = readLocalCollection<FlashcardReview>("reviews", userId).map<ReviewMetric>(({ id, reviewed_at }) => ({ id, reviewed_at }));
  const attempts = readLocalCollection<QuizAttempt>("quiz-attempts", userId).map<QuizMetric>(({ id, created_at, correct }) => ({ id, created_at, correct }));
  const focus = readLocalCollection<FocusSession>("focus-sessions", userId).map<FocusMetric>(({ id, completed_at, duration_minutes, status }) => ({ id, completed_at, duration_minutes, status }));
  return buildProgressSummary(reviews, attempts, focus);
}

function buildDemoPlan(userId: string) {
  const summary = summarizeDemoProgress(userId);
  const notes = readLocalCollection<Note>("notes", userId);
  const quizzes = readLocalCollection<Quiz>("quizzes", userId);
  const flashcards = readLocalCollection<Flashcard>("flashcards", userId);
  const dueCards = flashcards.filter((card) => Date.parse(card.due) <= Date.now()).length;
  const focus = readLocalCollection<FocusSession>("focus-sessions", userId);
  const hasOpenFocus = focus.some((session) => session.status === "active" || session.status === "paused");
  const plan = buildStudyPlan({ dueCards, notesCount: notes.length, quizzesCount: quizzes.length, hasOpenFocus, summary });
  return { plan, summary };
}

function persistDemoArtifact(call: ToolCall, result: Record<string, unknown>) {
  const userId = getDemoIdentity();
  if (!userId || result.persisted !== false) return;
  if (call.name === "create_note" && result.note) upsertLocalRecord("notes", userId, result.note as Note);
  if (call.name === "generate_flashcards" && Array.isArray(result.cards)) {
    (result.cards as Flashcard[]).forEach((card) => upsertLocalRecord("flashcards", userId, card));
  }
  if (call.name === "commit_flashcard_rating") {
    if (result.card) upsertLocalRecord("flashcards", userId, result.card as Flashcard);
    if (result.review) upsertLocalRecord("reviews", userId, result.review as FlashcardReview);
  }
  if (call.name === "start_quiz") {
    if (result.quiz) upsertLocalRecord("quizzes", userId, result.quiz as Quiz);
    if (Array.isArray(result.questions)) (result.questions as QuizQuestion[]).forEach((question) => upsertLocalRecord("quiz-questions", userId, question));
    if (Array.isArray(result.demo_answer_keys)) (result.demo_answer_keys as QuizAnswerKey[]).forEach((key) => upsertLocalRecord("quiz-answer-keys", userId, key));
  }
  if (call.name === "submit_quiz_answer" && result.attempt) upsertLocalRecord("quiz-attempts", userId, result.attempt as QuizAttempt);
  if (call.name === "start_focus_session" || call.name === "control_focus_timer") {
    if (result.previous_session) upsertLocalRecord("focus-sessions", userId, result.previous_session as FocusSession);
    if (result.session) upsertLocalRecord("focus-sessions", userId, result.session as FocusSession);
  }
}

export async function executeVoiceTool(call: ToolCall) {
  const endpoint = toolEndpoints[call.name];
  const demoUserId = getDemoIdentity();

  if (call.name === "summarize_progress") {
    if (demoUserId) return { isError: false, result: { summary: summarizeDemoProgress(demoUserId) } };
    try {
      const response = await inkoFetch("/api/study/plan", { method: "POST", body: JSON.stringify({ callId: call.call_id }) });
      const payload = (await response.json()) as Record<string, unknown>;
      return { isError: !response.ok, result: response.ok ? { summary: payload.summary } : payload };
    } catch {
      return { isError: true, result: { error: "Progress could not be summarized just now." } };
    }
  }

  if (call.name === "plan_study_session") {
    if (demoUserId) return { isError: false, result: buildDemoPlan(demoUserId) };
    try {
      const response = await inkoFetch("/api/study/plan", { method: "POST", body: JSON.stringify({ callId: call.call_id }) });
      const payload = (await response.json()) as Record<string, unknown>;
      return { isError: !response.ok, result: payload };
    } catch {
      return { isError: true, result: { error: "A plan could not be built just now." } };
    }
  }

  if (!endpoint) return { isError: true, result: { error: `Unknown tool: ${call.name}` } };

  if (call.name === "start_flashcard_review" && demoUserId) return { isError: false, result: startDemoReview(demoUserId) };

  try {
    const response = await inkoFetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ ...enrichDemoArguments(call), source: call.name === "create_note" ? "voice" : undefined, callId: call.call_id }),
    });
    const result = (await response.json()) as Record<string, unknown>;
    if (response.ok) persistDemoArtifact(call, result);
    delete result.demo_answer_keys;
    return { isError: !response.ok, result };
  } catch {
    return { isError: true, result: { error: "The study tool could not be reached. Ask the student to try again." } };
  }
}
