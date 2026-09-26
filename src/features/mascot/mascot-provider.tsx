"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { initialMascotState, mascotReducer, type MascotAction, type MascotState } from "./mascot-state";
import type { MascotCharacter } from "./sprite-manifest";

const CHARACTER_STORAGE_KEY = "inko.mascot.character";

function readStoredCharacter(): MascotCharacter {
  if (typeof window === "undefined") return "octopus";
  try {
    const value = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (value === "octopus" || value === "mrclaws") return value;
  } catch {
    // ignore storage failures
  }
  return "octopus";
}

type MascotContextValue = {
  state: MascotState;
  amplitude: number;
  character: MascotCharacter;
  setCharacter: (character: MascotCharacter) => void;
  dispatch: React.Dispatch<MascotAction>;
  setAmplitude: (value: number) => void;
  celebrate: (message?: string) => void;
};

const MascotContext = createContext<MascotContextValue | null>(null);
const SLEEP_AFTER_MS = 90_000;

export function MascotProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(mascotReducer, initialMascotState);
  const [amplitude, setAmplitudeState] = useState(0);
  const [character, setCharacterState] = useState<MascotCharacter>(() => readStoredCharacter());
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCharacter = useCallback((next: MascotCharacter) => {
    setCharacterState(next);
    try {
      window.localStorage.setItem(CHARACTER_STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, []);

  const setAmplitude = useCallback((value: number) => {
    setAmplitudeState(Math.max(0, Math.min(1, value)));
  }, []);

  const celebrate = useCallback((message?: string) => {
    dispatch({ type: "CELEBRATE", message });
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => dispatch({ type: "RESET_MOOD" }), 2800);
  }, []);

  useEffect(() => {
    let sleepTimer: ReturnType<typeof setTimeout>;
    const scheduleSleep = () => {
      clearTimeout(sleepTimer);
      dispatch({ type: "WAKE" });
      sleepTimer = setTimeout(() => dispatch({ type: "SLEEP" }), SLEEP_AFTER_MS);
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown"];
    events.forEach((event) => window.addEventListener(event, scheduleSleep, { passive: true }));
    scheduleSleep();
    return () => {
      clearTimeout(sleepTimer);
      if (moodTimer.current) clearTimeout(moodTimer.current);
      events.forEach((event) => window.removeEventListener(event, scheduleSleep));
    };
  }, []);

  const value = useMemo(
    () => ({ state, amplitude, character, setCharacter, dispatch, setAmplitude, celebrate }),
    [state, amplitude, character, setCharacter, setAmplitude, celebrate],
  );
  return <MascotContext.Provider value={value}>{children}</MascotContext.Provider>;
}

export function useMascot() {
  const value = useContext(MascotContext);
  if (!value) throw new Error("useMascot must be used within MascotProvider");
  return value;
}
