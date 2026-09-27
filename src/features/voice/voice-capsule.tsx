"use client";

import { Mic, Square } from "lucide-react";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useVoiceAgent } from "./use-voice-agent";
import { useOptionalVoiceAgent, type VoiceAgentController } from "./voice-agent-provider";

// Explicit bar heights (px) form the resting sound-wave shape on each side of
// the mic. Kept as real values because CSS calc() has no modulo operator.
const WAVE = [7, 11, 16, 22, 18, 12, 8, 14, 20, 25, 19, 13, 9, 6];

function hintFor(connection: VoiceAgentController["connection"], partial: string) {
  switch (connection) {
    case "connecting":
      return "Connecting voice…";
    case "connected":
      return partial || "Listening — speak naturally";
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

function VoiceCapsuleView({ controller }: { controller: VoiceAgentController }) {
  const { connection, partialTranscript, error, start, end } = controller;
  const { amplitude } = useMascot();
  const active = connection === "connected" || connection === "connecting" || connection === "ending";
  const capturing = connection === "connected";
  const amp = Math.min(1, amplitude);

  return (
    <div className="voice-capsule-wrap">
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
        {hintFor(connection, partialTranscript)}
      </p>

      {error && <p className="voice-capsule-error" role="status">{error}</p>}
    </div>
  );
}

function StandaloneVoiceCapsule() {
  const controller = useVoiceAgent();
  return <VoiceCapsuleView controller={controller} />;
}

export function VoiceCapsule() {
  const shared = useOptionalVoiceAgent();
  return shared ? <VoiceCapsuleView controller={shared} /> : <StandaloneVoiceCapsule />;
}
