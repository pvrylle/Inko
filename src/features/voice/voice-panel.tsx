"use client";

import { ArrowRight, Keyboard, Mic, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useVoiceAgent } from "./use-voice-agent";

const connectionCopy: Record<string, { title: string; hint: string }> = {
  idle: { title: "Tap to talk", hint: "or type a message below" },
  connecting: { title: "Connecting…", hint: "Warming up your session" },
  connected: { title: "Inko is listening", hint: "Speak naturally — you can interrupt me" },
  ending: { title: "Wrapping up…", hint: "Saving the last bit" },
  error: { title: "Let's try again", hint: "Restart when you're ready" },
};

export function VoicePanel() {
  const { connection, messages, partialTranscript, error, start, end, sendText } = useVoiceAgent();
  const { amplitude } = useMascot();
  const [text, setText] = useState("");
  const active = connection === "connected" || connection === "connecting" || connection === "ending";
  const copy = connectionCopy[connection] ?? connectionCopy.idle;
  const hint = partialTranscript || copy.hint;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    void sendText(text);
    setText("");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || (target?.isContentEditable ?? false);
      if (inField || event.metaKey || event.ctrlKey || event.altKey) return;
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
    <section className="voice-experience" aria-label="Talk to Inko">
      <div className="talk-panel">
        <div className="mic-orbit" data-active={active} style={{ "--voice-amp": Math.min(1, amplitude) } as React.CSSProperties}>
          <span className="mic-ring mic-ring-outer" aria-hidden="true" />
          <span className="mic-ring mic-ring-middle" aria-hidden="true" />
          <button
            aria-label={active ? "End voice session" : "Start talking to Inko"}
            className="mic-button"
            data-active={active}
            disabled={connection === "ending"}
            onClick={active ? end : start}
            type="button"
          >
            <span className="mic-ripple" aria-hidden="true" />
            {active ? <Square aria-hidden="true" fill="currentColor" size={22} /> : <Mic aria-hidden="true" size={28} strokeWidth={2.5} />}
          </button>
        </div>
        <div>
          <strong>{copy.title}</strong>
          <span data-partial={partialTranscript ? "true" : "false"}>{hint}</span>
          <small className="keyboard-hint"><Keyboard size={12} /> Shift + Space to talk</small>
        </div>
        <form className="message-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="message">Message Inko</label>
          <input id="message" onChange={(event) => setText(event.target.value)} placeholder="Ask Inko anything…" type="text" value={text} />
          <button aria-label="Send message" type="submit"><ArrowRight size={19} /></button>
        </form>
      </div>

      {error && <div className="voice-error" role="status"><X size={16} /> {error}</div>}

      {messages.length > 0 && (
        <div className="live-transcript" aria-live="polite">
          {messages.slice(-4).map((message) => (
            <p data-role={message.role} key={message.id}>
              <span className="avatar" aria-hidden="true">{message.role === "inko" ? "◐" : "•"}</span>
              <span className="bubble">
                <strong>{message.role === "inko" ? "Inko" : "You"}</strong>
                <span>{message.text}</span>
              </span>
            </p>
          ))}
        </div>
      )}
      <p className="privacy-caption">Audio streams directly to AssemblyAI and is never stored by Inko or Supabase. Inko requests provider-session deletion after each call and retries pending cleanup on a protected schedule.</p>
    </section>
  );
}
