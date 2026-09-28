"use client";

import { Mic, Square } from "lucide-react";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useVoiceAgent } from "./use-voice-agent";
import { useOptionalVoiceAgent, type VoiceAgentController } from "./voice-agent-provider";

// Explicit bar heights (px) form the resting sound-wave shape on each side of
// the mic. Kept as real values because CSS calc() has no modulo operator.
const WAVE = [7, 11, 16, 22, 18, 12, 8, 14, 20, 25, 19, 13, 9, 6];

function captionFor(
  connection: VoiceAgentController["connection"],
  partial: string,
  messages: VoiceAgentController["messages"],
  error: string | null,
  replyPending: boolean,
  compact: boolean,
) {
  const last = messages.at(-1);
  const spoken = last?.role === "inko" ? last.text : "";
  const heard = spoken.replace(/\s*\[\d+\]/g, "").replace(/\s+/g, " ").trim();
  if (replyPending && !error) return "Looking up sources…";
  if (partial && partial !== spoken && partial !== heard) return partial;
  if (compact && last?.role === "inko") return "Ask a follow-up";
  if (last?.role === "inko") return spoken;
  if (connection === "idle" && error) return error;
  return hintFor(connection, partial);
}

function hintFor(connection: VoiceAgentController["connection"], partial: string) {
  switch (connection) {
    case "connecting":
      return "Connecting voice…";
    case "connected":
      return partial || "Listening — I’ll answer when you pause";
    case "ending":
      return "Wrapping up…";
    case "error":
      return "Voice needs a quick reset — tap to try again";
    default:
      return 'Tap to speak · or say "Hey Inko"';
  }
}

function Wave({ side, amp, active }: { side: "left" | "right"; amp: number; active: boolean }) {
  return (
    <div className={`voice-capsule-wave voice-capsule-wave-${side}`} aria-hidden="true">
      {WAVE.map((height, index) => (
        <span
          key={index}
          data-active={active}
          style={{ height: `${height}px`, "--bar": index, "--amp": amp } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function VoiceCapsuleView({ controller, compact = false }: { controller: VoiceAgentController; compact?: boolean }) {
  const { connection, messages, partialTranscript, error, replyPending, start, end } = controller;
  const { amplitude } = useMascot();
  const active = connection === "connected" || connection === "connecting" || connection === "ending";
  const capturing = connection === "connected";
  const amp = Math.min(1, amplitude);
  return (
    <div className="voice-capsule-wrap" data-compact={compact}>
      <div className="voice-capsule" data-active={active} data-capturing={capturing}>
        <Wave side="left" amp={amp} active={active} />

        <button
          aria-label={active ? "End voice session" : "Start talking to Inko"}
          aria-pressed={active}
          className="voice-capsule-mic"
          data-active={active}
          disabled={connection === "ending"}
          onClick={active ? end : () => void start()}
          type="button"
        >
          <span className="voice-capsule-ripple" aria-hidden="true" />
          {active ? <Square aria-hidden="true" fill="currentColor" size={20} /> : <Mic aria-hidden="true" size={24} strokeWidth={2.4} />}
        </button>

        <Wave side="right" amp={amp} active={active} />
      </div>

      <p className="voice-capsule-hint" data-partial={partialTranscript ? "true" : "false"} aria-live="polite">
        {captionFor(connection, partialTranscript, messages, error, replyPending, compact)}
      </p>

      {error && !compact ? <p className="voice-capsule-error" role="status">{error}</p> : null}
    </div>
  );
}

function StandaloneVoiceCapsule({ compact }: { compact: boolean }) {
  const controller = useVoiceAgent();
  return <VoiceCapsuleView compact={compact} controller={controller} />;
}

export function VoiceCapsule({ compact = false }: { compact?: boolean }) {
  const shared = useOptionalVoiceAgent();
  return shared ? <VoiceCapsuleView compact={compact} controller={shared} /> : <StandaloneVoiceCapsule compact={compact} />;
}
