"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "inko.focus.daily-goal";
const SCENE_KEY = "inko.focus.scene";
const CHANGE_EVENT = "inko:local-preference-change";
const DEFAULT_GOAL_MINUTES = 60;

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => callback();
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function readNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readString(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

export function useDailyGoal() {
  const goalMinutes = useSyncExternalStore(
    subscribe,
    () => readNumber(STORAGE_KEY, DEFAULT_GOAL_MINUTES),
    () => DEFAULT_GOAL_MINUTES,
  );

  const setGoalMinutes = useCallback((minutes: number) => {
    if (typeof window === "undefined") return;
    const clamped = Math.max(15, Math.min(360, Math.round(minutes)));
    window.localStorage.setItem(STORAGE_KEY, String(clamped));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { goalMinutes, setGoalMinutes };
}

export function useSelectedScene(defaultScene: string) {
  const scene = useSyncExternalStore(
    subscribe,
    () => readString(SCENE_KEY, defaultScene),
    () => defaultScene,
  );

  const setScene = useCallback((next: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SCENE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { scene, setScene };
}
