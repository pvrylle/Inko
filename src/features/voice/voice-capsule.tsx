"use client";

import { Mic, Square } from "lucide-react";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useVoiceAgent, type VoicePhase } from "./use-voice-agent";
import { useOptionalVoiceAgent, type VoiceAgentController } from "./voice-agent-provider";

// Explicit bar heights (px) form the resting sound-wave shape on each side of
// the mic. Kept as real values because CSS calc() has no modulo operator.
const WAVE = [7, 11, 16, 22, 18, 12, 8, 14, 20, 25, 19, 13, 9, 6];

function resolvePhase(controller: VoiceAgentController): VoicePhase {
  if (controller.phase) return controller.phase;
  if (controller.connection === "error" || (controller.connection === "idle" && controller.error)) return "error";
  if (controller.connection === "ending") return "ending";
  if (controller.replySpeaking) return "speaking";
  if (controller.replyPending) return "working";
  if (controller.connection === "connecting") return "connecting";
  if (controller.connection === "connected") return "listening";
  return "idle";
}

function captionFor(phase: VoicePhase) {
  switch (phase) {
    case "speaking":
      return "Inko is speaking";
    case "working":
      return "Inko is working";
    case "pausing":
      return "Pause to send";
    case "listening":
      return "Listening";
    case "connecting":
      return "Connecting voice…";
    case "ending":
      return "Wrapping up…";
    case "error":
      return "Voice needs a quick reset — tap to try again";
    default:
      return "Tap to speak";
  }
}

function Wave({ side, amp, active }: { side: "left" | "right"; amp: number; active: boolean }) {
  return (
    <div className={`voice-capsule-wave voice-capsule-wave-${side}`} aria-hidden="true">
      {WAVE.map((height, index) => (
        <span
          key={index}
          data-active={active}
          style={{ height: `${height}px`, "--bar": index, "--amp": amp, "--level": amp * (0.55 + ((index * 7) % 9) / 10) } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function VoiceCapsuleView({ controller, compact = false }: { controller: VoiceAgentController; compact?: boolean }) {
  const { connection, error, start, end } = controller;
  const { amplitude } = useMascot();
  const phase = resolvePhase(controller);
  const sessionOpen = phase === "connecting" || phase === "listening" || phase === "pausing" || phase === "working" || phase === "speaking" || phase === "ending";
  const showStop = phase === "listening" || phase === "pausing" || phase === "ending";
  const amp = Math.min(1, amplitude);
  const voiceVisible = (phase === "listening" || phase === "pausing") && amp > 0.04;
  return (
    <div className="voice-capsule-wrap" data-compact={compact}>
      <div className="voice-capsule" data-phase={phase} data-capturing={voiceVisible}>
        <Wave side="left" amp={amp} active={voiceVisible} />

        <button
          aria-label={sessionOpen ? "End voice session" : "Start talking to Inko"}
          aria-pressed={sessionOpen}
          className="voice-capsule-mic"
          data-phase={phase}
          disabled={connection === "ending"}
          onClick={sessionOpen ? end : () => void start()}
          type="button"
        >
          <span className="voice-capsule-ripple" aria-hidden="true" />
          {phase === "pausing" ? <span key={controller.pauseEpoch ?? 0} className="voice-capsule-ring" aria-hidden="true"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" pathLength="100" /></svg></span> : null}
          {showStop ? <Square aria-hidden="true" fill="currentColor" size={20} /> : <Mic aria-hidden="true" size={24} strokeWidth={2.4} />}
        </button>

        <Wave side="right" amp={amp} active={voiceVisible} />
      </div>

      <p className="voice-capsule-hint" aria-live="polite">
        {captionFor(phase)}
      </p>

      {error && !compact && phase === "error" ? <p className="voice-capsule-error" role="status">{error}</p> : null}
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
