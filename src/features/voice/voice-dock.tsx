"use client";

import { Mic, Radio, Square } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useOptionalVoiceAgent } from "./voice-agent-provider";

const stateCopy = {
  idle: "Ask Inko",
  listening: "Listening",
  thinking: "Thinking",
  working: "Working",
  researching: "Researching",
  speaking: "Speaking",
  sleeping: "Ask Inko",
  error: "Try again",
} as const;

export function PersistentVoiceDock() {
  const pathname = usePathname();
  const controller = useOptionalVoiceAgent();
  const { state } = useMascot();

  const hideDock = !pathname || pathname === "/" || pathname === "/welcome" || [
    "/research",
    "/sources",
    "/canvas",
    "/practice",
    "/flashcards",
    "/quiz",
    "/focus",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!controller || hideDock) return null;

  const active = controller.connection === "connected" || controller.connection === "connecting" || controller.connection === "ending";
  const label = controller.connection === "connecting"
    ? "Connecting"
    : controller.connection === "ending"
      ? "Wrapping up"
      : controller.connection === "connected" && state.presence === "idle"
        ? "Microphone live"
        : stateCopy[state.presence];

  return (
    <aside className="voice-dock" data-active={active} aria-label="Inko study companion">
      <button
        aria-label={active ? "End voice session" : "Start talking to Inko"}
        aria-pressed={active}
        className="voice-dock-button"
        disabled={controller.connection === "ending"}
        onClick={active ? controller.end : () => void controller.start()}
        type="button"
      >
        <span className="voice-dock-provider"><Radio aria-hidden="true" size={11} /> Live voice</span>
        <span className="voice-dock-content">
          <span className="voice-dock-icon" aria-hidden="true">
            {active ? <Square fill="currentColor" size={14} /> : <Mic size={18} />}
          </span>
          <span className="voice-dock-copy">
            <strong>{label}</strong>
            <small>{active ? "Conversation stays active across pages" : "Tap to start a live study session"}</small>
          </span>
        </span>
      </button>
    </aside>
  );
}
