"use client";

import { useEffect, useState } from "react";
import { InkoMascot } from "./inko-mascot";
import { useMascot } from "./mascot-provider";

const idleTips = [
  "What are we studying today?",
  "Say a topic and I'll shape a note.",
  "Ask me for a quick quiz any time.",
  "Need to focus? I can start a timer.",
];

export function MascotStage() {
  const { state, amplitude, dispatch } = useMascot();
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (state.presence !== "idle" || state.mood !== "neutral" || state.mode !== "normal") return;
    const timer = window.setInterval(() => setTipIndex((current) => (current + 1) % idleTips.length), 5200);
    return () => window.clearInterval(timer);
  }, [state.presence, state.mood, state.mode]);

  const showTip = state.presence === "idle" && state.mood === "neutral" && state.mode === "normal" && state.message === "What are we studying today?";
  const message = showTip ? idleTips[tipIndex] : state.message;

  return (
    <section className="mascot-stage" aria-live="polite">
      <button className="mascot-button" type="button" onClick={() => dispatch({ type: "WAKE" })} aria-label={`Inko is ${state.presence}. Tap to wake Inko.`}>
        <InkoMascot amplitude={amplitude} state={state} />
      </button>
      <div className="speech-bubble" data-presence={state.presence}>
        <span key={message}>{message}</span>
      </div>
    </section>
  );
}
