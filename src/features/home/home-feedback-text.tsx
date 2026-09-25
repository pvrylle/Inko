"use client";

import { useMascot } from "@/features/mascot/mascot-provider";
import type { MascotPresence } from "@/features/mascot/mascot-state";

const feedbackText: Record<MascotPresence, string> = {
  idle:        "What are we studying today?",
  sleeping:    "What are we studying today?",
  error:       "What are we studying today?",
  listening:   "I'm listening…",
  thinking:    "Let me investigate that.",
  working:     "Let me investigate that.",
  researching: "I'm comparing the evidence.",
  speaking:    "Here's what I found.",
};

export function HomeFeedbackText() {
  const { state } = useMascot();
  return (
    <p
      className="home-feedback-text"
      aria-live="polite"
      aria-atomic="true"
    >
      {feedbackText[state.presence]}
    </p>
  );
}
