"use client";

import { Mic, Square } from "lucide-react";
import { useState } from "react";
import { useMascot } from "@/features/mascot/mascot-provider";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import type { VoicePhase } from "@/features/voice/use-voice-agent";

const PLACEHOLDER = "Ask about this investigation. I can explain a finding or point at a gap.";

function tutorCaption(phase: VoicePhase) {
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
      return "Voice needs a quick reset";
    default:
      return "Tutor";
  }
}

export function ResearchTutor() {
  const controller = useOptionalVoiceAgent();
  const { state } = useMascot();
  const [text, setText] = useState("");
  if (!controller) return null;

  const { connection, draftReply, end, messages, partialTranscript, phase, replyPending, sendText, start } = controller;
  const lastReply = [...messages].reverse().find((message) => message.role === "inko")?.text;
  const hearing = phase === "listening" || phase === "pausing";
  const reply = draftReply
    || (hearing && partialTranscript ? partialTranscript : "")
    || lastReply
    || PLACEHOLDER;
  const sessionOpen = connection === "connecting" || connection === "connected" || connection === "ending";
  const showStop = phase === "listening" || phase === "pausing" || phase === "ending";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value || replyPending) return;
    setText("");
    void sendText(value);
  }

  return (
    <section className="research-tutor" aria-label="Inko tutor">
      <div className="research-tutor-head">
        <InkoMascot className="research-tutor-mascot" fit="cover" state={state} />
        <div className="research-tutor-copy">
          <span>{tutorCaption(phase)}</span>
          <p aria-live="polite">{reply}</p>
        </div>
      </div>
      <form className="research-tutor-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="research-tutor-input">Ask Inko</label>
        <input
          id="research-tutor-input"
          maxLength={2000}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask Inko about this investigation"
          value={text}
        />
        <button className="research-tutor-ask" disabled={!text.trim() || replyPending} type="submit">Ask</button>
        <button
          aria-label={sessionOpen ? "End voice session" : "Start talking to Inko"}
          aria-pressed={sessionOpen}
          className="research-tutor-mic"
          disabled={phase === "ending"}
          onClick={sessionOpen ? end : () => void start()}
          type="button"
        >
          {showStop ? <Square aria-hidden="true" fill="currentColor" size={14} /> : <Mic aria-hidden="true" size={16} />}
        </button>
      </form>
    </section>
  );
}
