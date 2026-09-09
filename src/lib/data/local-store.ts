"use client";

const PREFIX = "inko.data.";
const CHANGE_EVENT = "inko:local-data-change";

export type LocalCollection = "notes" | "flashcards" | "reviews" | "quizzes" | "quiz-questions" | "quiz-answer-keys" | "quiz-attempts" | "focus-sessions" | "chat-turns" | "voice-sessions";

type Identifiable = { id: string };

function key(collection: LocalCollection, userId: string) {
  return `${PREFIX}${userId}.${collection}`;
}

export function readLocalCollection<T>(collection: LocalCollection, userId: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(key(collection, userId));
    return value ? (JSON.parse(value) as T[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalCollection<T>(collection: LocalCollection, userId: string, values: T[]) {
  window.localStorage.setItem(key(collection, userId), JSON.stringify(values));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { collection, userId } }));
}

export function upsertLocalRecord<T extends Identifiable>(collection: LocalCollection, userId: string, value: T) {
  const values = readLocalCollection<T>(collection, userId);
  const index = values.findIndex((item) => item.id === value.id);
  if (index >= 0) values[index] = value;
  else values.unshift(value);
  writeLocalCollection(collection, userId, values);
  return value;
}

export function deleteLocalRecord<T extends Identifiable>(collection: LocalCollection, userId: string, id: string) {
  const values = readLocalCollection<T>(collection, userId).filter((item) => item.id !== id);
  writeLocalCollection(collection, userId, values);
}

export function subscribeToLocalCollection(collection: LocalCollection, userId: string, callback: () => void) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ collection: LocalCollection; userId: string }>).detail;
    if (detail.collection === collection && detail.userId === userId) callback();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", callback);
  };
}
