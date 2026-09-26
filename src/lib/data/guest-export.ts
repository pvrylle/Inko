"use client";

import {
  readLocalCollection,
  writeLocalCollection,
  type LocalCollection,
} from "./local-store";
import type {
  Note,
  Flashcard,
  FlashcardReview,
  Quiz,
  QuizQuestion,
  QuizAnswerKey,
  QuizAttempt,
  FocusSession,
} from "./models";

const DEMO_USER_KEY = "inko.demo-user-id";

export type GuestDataExport = {
  notes: Note[];
  flashcards: Flashcard[];
  reviews: FlashcardReview[];
  quizzes: Quiz[];
  quizQuestions: QuizQuestion[];
  quizAnswerKeys: QuizAnswerKey[];
  quizAttempts: QuizAttempt[];
  focusSessions: FocusSession[];
};

const COLLECTIONS: LocalCollection[] = [
  "notes",
  "flashcards",
  "reviews",
  "quizzes",
  "quiz-questions",
  "quiz-answer-keys",
  "quiz-attempts",
  "focus-sessions",
];

export function getGuestUserId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEMO_USER_KEY);
}

export function exportGuestData(userId: string): GuestDataExport {
  return {
    notes: readLocalCollection<Note>("notes", userId),
    flashcards: readLocalCollection<Flashcard>("flashcards", userId),
    reviews: readLocalCollection<FlashcardReview>("reviews", userId),
    quizzes: readLocalCollection<Quiz>("quizzes", userId),
    quizQuestions: readLocalCollection<QuizQuestion>("quiz-questions", userId),
    quizAnswerKeys: readLocalCollection<QuizAnswerKey>("quiz-answer-keys", userId),
    quizAttempts: readLocalCollection<QuizAttempt>("quiz-attempts", userId),
    focusSessions: readLocalCollection<FocusSession>("focus-sessions", userId),
  };
}

export function clearGuestData(userId: string) {
  for (const collection of COLLECTIONS) {
    writeLocalCollection(collection, userId, []);
  }
}
