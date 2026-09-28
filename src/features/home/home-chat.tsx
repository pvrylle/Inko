"use client";

import { ArrowUp, PanelLeft, Plus } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import { VoiceCapsule } from "@/features/voice/voice-capsule";
import type { VoiceAgentController } from "@/features/voice/voice-agent-provider";
import type { VoiceMessage } from "@/features/voice/voice-types";
import { AnswerToolIcons, StudyAnswerText } from "./study-answer-card";

function questionBefore(messages: VoiceMessage[], index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (messages[cursor]?.role === "student") return messages[cursor].text;
  }
  return "";
}

function ChatTurn({ message, question, sessionId, onResearchSessionCreated }: { message: VoiceMessage; question: string; sessionId: string | null; onResearchSessionCreated: (id: string) => void }) {
  const sources = message.sources ?? [];
  const isInko = message.role === "inko";

  return (
    <article className="home-turn" data-role={message.role}>
      <span className="home-turn-speaker">{isInko ? "Inko" : "You"}</span>
      {isInko ? <StudyAnswerText sources={sources} text={message.text} /> : <p>{message.text}</p>}
      {isInko && (sources.length > 0 || message.text) ? (
        <details className="home-turn-more">
          <summary>Sources and actions{sources.length > 0 ? ` · ${sources.length} sources` : ""}</summary>
          {sources.length > 0 ? (
            <ul className="home-turn-sources">
              {sources.map((source, index) => (
                <li key={`${source.url}-${index}`}>
                  <a href={source.url} rel="noopener noreferrer" target="_blank">{index + 1}. {source.title}</a>
                </li>
              ))}
            </ul>
          ) : null}
          <AnswerToolIcons answer={message} question={question} sessionId={sessionId} onResearchSessionCreated={onResearchSessionCreated} />
        </details>
      ) : null}
    </article>
  );
}

export function HomeChat({
  controller,
  onNewSession,
  onToggleSessions,
  sessionsOpen,
}: {
  controller: VoiceAgentController;
  onNewSession: () => void;
  onToggleSessions: () => void;
  sessionsOpen: boolean;
}) {
  const { state } = useMascot();
  const { messages, replyPending, error, activeSessionId } = controller;
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const active = controller.sessions.find((session) => session.id === activeSessionId);
  const title = active?.title || "New conversation";
  const status = error ? "Needs attention" : replyPending ? "Working" : controller.connection === "connected" ? "Listening" : "Ready";

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [activeSessionId]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const distance = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    if (distance < 180) {
      if (typeof thread.scrollTo === "function") thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
      else thread.scrollTop = thread.scrollHeight;
    }
  }, [messages, replyPending]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || replyPending) return;
    setDraft("");
    void controller.sendText(text);
  };

  const onDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <section className="home-chat" aria-label="Inko conversation">
      <header className="home-chat-bar">
        <button
          aria-controls="home-conversations"
          aria-expanded={sessionsOpen}
          aria-label={sessionsOpen ? "Hide conversations" : "Show conversations"}
          className="home-chat-sessions-toggle"
          onClick={onToggleSessions}
          type="button"
        >
          <PanelLeft aria-hidden="true" size={19} />
        </button>
        <div className="home-chat-title">
          <span>Inko companion</span>
          <h1>{title}</h1>
        </div>
        {messages.length > 0 ? (
          <div className="home-chat-presence">
            <span className="home-chat-presence-copy"><strong>Inko</strong><small>{status}</small></span>
            <InkoMascot className="home-chat-presence-mascot" fit="cover" state={state} />
          </div>
        ) : null}
        <button aria-label="New conversation" className="home-chat-new" onClick={onNewSession} type="button">
          <Plus aria-hidden="true" size={17} /> <span>New chat</span>
        </button>
      </header>

      <div className="home-chat-main">
        <div className="home-chat-thread" ref={threadRef}>
          {messages.length === 0 ? (
            <div className="home-chat-welcome">
              <InkoMascot className="home-chat-welcome-mascot" fit="contain" state={state} />
              <h2>What can I help you with?</h2>
              <p>Ask a question, talk it through, or give Inko a task.</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatTurn key={message.id} message={message} question={questionBefore(messages, index)} sessionId={active?.research_session_id ?? null} onResearchSessionCreated={controller.linkResearchSession} />
            ))
          )}
          {replyPending ? (
            <article aria-live="polite" className="home-turn home-turn-pending" data-role="inko">
              <span className="home-turn-speaker">Inko</span>
              <p>Working on it<span className="home-thinking-dots" aria-hidden="true">…</span></p>
            </article>
          ) : null}
          {error ? <p className="home-chat-error" role="status">{error}</p> : null}
        </div>

        <div className="home-chat-composer-area">
          <form className="home-chat-composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="home-chat-input">Message Inko</label>
            <textarea
              id="home-chat-input"
              maxLength={4000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onDraftKeyDown}
              placeholder="Message Inko…"
              rows={2}
              value={draft}
            />
            <button aria-label="Send message" className="home-chat-send" disabled={!draft.trim() || replyPending} type="submit">
              <ArrowUp aria-hidden="true" size={20} />
            </button>
          </form>
          <VoiceCapsule compact />
        </div>
      </div>
    </section>
  );
}
