"use client";

import { ArrowUp, Keyboard, LockKeyhole, Mic, Radio, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useVoiceAgent } from "./use-voice-agent";
import { useOptionalVoiceAgent, type VoiceAgentController } from "./voice-agent-provider";

const connectionCopy = {
  idle: { title: "What would you like to study?", hint: "Tap the microphone and speak naturally" },
  connecting: { title: "Opening a private voice session…", hint: "Connecting securely to AssemblyAI" },
  connected: { title: "Inko is ready", hint: "Speak naturally — you can interrupt at any time" },
  ending: { title: "Wrapping up your session…", hint: "Saving the final study turn" },
  error: { title: "Voice needs a quick reset", hint: "Try again or type your question below" },
} as const;

const presenceCopy = {
  idle: "Microphone is live — start speaking.",
  listening: "Capturing your voice…",
  thinking: "Let me understand that.",
  working: "I’m turning that into something useful.",
  researching: "I’m comparing the evidence.",
  speaking: "Here’s what I found.",
  sleeping: "Tap the microphone to wake me.",
  error: "We can recover — try once more.",
} as const;

const studyPrompts = [
  "Plan my next study session",
  "Turn this topic into a clear note",
  "Quiz me without revealing the answer",
  "Start a 25 minute focus session",
];

function StandaloneVoicePanel() {
  const controller = useVoiceAgent();
  return <VoicePanelView controller={controller} />;
}

export function VoicePanel() {
  const sharedController = useOptionalVoiceAgent();
  return sharedController
    ? <VoicePanelView controller={sharedController} />
    : <StandaloneVoicePanel />;
}

function VoicePanelView({ controller }: { controller: VoiceAgentController }) {
  const { connection, messages, partialTranscript, error, dictating, start, end, sendText } = controller;
  const { amplitude, state } = useMascot();
  const [text, setText] = useState("");
  const active = connection === "connected" || connection === "connecting" || connection === "ending";
  const capturing = connection === "connected";
  const copy = dictating
    ? { title: "Listening…", hint: "Speak now — tap the microphone again to send" }
    : (connectionCopy[connection] ?? connectionCopy.idle);
  const liveHint = dictating
    ? (partialTranscript || copy.hint)
    : partialTranscript || (connection === "connected" ? presenceCopy[state.presence] : copy.hint);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    void sendText(value);
    setText("");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || (target?.isContentEditable ?? false);
      if (inField || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (event.code === "Space" && event.shiftKey) {
        event.preventDefault();
        if (active) end();
        else void start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, end, start]);

  return (
    <section className="voice-experience" data-capturing={capturing} data-connection={connection} aria-label="Talk to Inko">
      <div className="voice-provider-row">
        <button
          aria-label={active ? "End AssemblyAI live session" : "Start AssemblyAI live session"}
          aria-pressed={active}
          className="voice-provider-badge"
          disabled={connection === "ending"}
          onClick={active ? end : () => void start()}
          type="button"
        >
          <Radio aria-hidden="true" size={12} />
          {dictating ? "Capturing your voice" : active ? "AssemblyAI session live" : "Start with AssemblyAI"}
        </button>
        <span className="voice-private-badge" data-live={capturing}><LockKeyhole aria-hidden="true" size={11} /> {capturing ? "microphone capturing" : "private live session"}</span>
      </div>

      <div className="talk-panel">
        <div className="voice-wave" data-active={active} aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => (
            <span key={index} style={{ "--wave-index": index, "--voice-amp": Math.min(1, amplitude) } as React.CSSProperties} />
          ))}
        </div>

        <div className="voice-primary-copy" aria-live="polite">
          <strong>{dictating ? copy.title : connection === "connected" ? presenceCopy[state.presence] : copy.title}</strong>
          <span data-partial={partialTranscript ? "true" : "false"}>{liveHint}</span>
        </div>

        <div className="mic-orbit" data-active={active} style={{ "--voice-amp": Math.min(1, amplitude) } as React.CSSProperties}>
          <span className="mic-ring mic-ring-outer" aria-hidden="true" />
          <span className="mic-ring mic-ring-middle" aria-hidden="true" />
          <button
            aria-label={active ? "End voice session" : "Start talking to Inko"}
            aria-pressed={active}
            className="mic-button"
            data-active={active}
            disabled={connection === "ending"}
            onClick={active ? end : () => void start()}
            type="button"
          >
            <span className="mic-ripple" aria-hidden="true" />
            {active ? <Square aria-hidden="true" fill="currentColor" size={22} /> : <Mic aria-hidden="true" size={30} strokeWidth={2.4} />}
          </button>
        </div>

        <div className="voice-wave voice-wave-right" data-active={active} aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => (
            <span key={index} style={{ "--wave-index": index, "--voice-amp": Math.min(1, amplitude) } as React.CSSProperties} />
          ))}
        </div>

        <small className="keyboard-hint"><Keyboard size={12} /> Shift + Space toggles your voice session</small>

        <form className="message-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="message">Message Inko</label>
          <input id="message" onChange={(event) => setText(event.target.value)} placeholder="Ask Inko anything…" type="text" value={text} />
          <button aria-label="Send message" disabled={!text.trim()} type="submit"><ArrowUp size={19} /></button>
        </form>

        <div className="voice-prompt-list" aria-label="Study prompt ideas">
          {studyPrompts.map((prompt) => (
            <button key={prompt} onClick={() => setText(prompt)} type="button">{prompt}</button>
          ))}
        </div>
      </div>

      {error && <div className="voice-error" role="status"><X size={16} /> {error}</div>}

      {messages.length > 0 && (
        <div className="live-transcript" aria-label="Live study conversation" aria-live="polite">
          <div className="live-transcript-heading">
            <strong>Study conversation</strong>
            <span>{messages.length} turns</span>
          </div>
          {messages.slice(-4).map((message) => (
            <p data-role={message.role} key={message.id}>
              <span className="avatar" aria-hidden="true">{message.role === "inko" ? "I" : "Y"}</span>
              <span className="bubble">
                <strong>{message.role === "inko" ? "Inko" : "You"}</strong>
                <span>{message.text}</span>
              </span>
            </p>
          ))}
        </div>
      )}

      <p className="privacy-caption">Your microphone streams directly to AssemblyAI for the live conversation. Inko does not store audio, and requests deletion when the session ends.</p>
    </section>
  );
}
