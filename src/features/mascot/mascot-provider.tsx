"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { initialMascotState, mascotReducer, type MascotAction, type MascotState } from "./mascot-state";

type MascotContextValue = {
  state: MascotState;
  amplitude: number;
  dispatch: React.Dispatch<MascotAction>;
  setAmplitude: (value: number) => void;
  celebrate: (message?: string) => void;
};

const MascotContext = createContext<MascotContextValue | null>(null);
const SLEEP_AFTER_MS = 90_000;

export function MascotProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(mascotReducer, initialMascotState);
  const [amplitude, setAmplitudeState] = useState(0);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const value = useMemo(() => ({ state, amplitude, dispatch, setAmplitude, celebrate }), [state, amplitude, setAmplitude, celebrate]);
  return <MascotContext.Provider value={value}>{children}</MascotContext.Provider>;
}

export function useMascot() {
  const value = useContext(MascotContext);
  if (!value) throw new Error("useMascot must be used within MascotProvider");
  return value;
}
