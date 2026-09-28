"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import { createSource } from "@/features/research/research-repository";
import type { ResearchSession } from "@/features/research/research-schema";
import { VoiceCapsule } from "@/features/voice/voice-capsule";
import type { VoiceAgentController } from "@/features/voice/voice-agent-provider";
import type { VoiceMessage } from "@/features/voice/voice-types";
import { AnswerToolIcons, StudyAnswerCard, StudyAnswerText } from "./study-answer-card";

function studyQuestion(question: string) {
  const asked = question.trim();
  if (asked.length >= 10) return asked.slice(0, 500);
  return asked.length > 0 ? `${asked} — explain this for study`.slice(0, 500) : "Study this topic from the sources Inko found.";
}

function ThinkingTurn() {
  const { state } = useMascot();
  return (
    <article className="home-turn" data-pending="true" data-role="inko">
      <span className="home-turn-who">
        <InkoMascot className="home-turn-mascot" fit="cover" state={state} />
        Inko
      </span>
      <p>Looking up sources…</p>
    </article>
  );
}

function questionBefore(messages: VoiceMessage[], index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const earlier = messages[cursor];
    if (earlier?.role === "student") return earlier.text;
  }
  return "";
}

function ChatTurn({
  message,
  question,
  sessionId,
}: {
  message: VoiceMessage;
  question: string;
  sessionId: string | null;
}) {
  const sources = message.sources ?? [];
  return (
    <article className="home-turn" data-role={message.role}>
      <span>{message.role === "inko" ? "Inko" : "You"}</span>
      {message.role === "inko" ? <StudyAnswerText sources={sources} text={message.text} /> : <p>{message.text}</p>}
      {message.role === "inko" ? <AnswerToolIcons answer={message} question={question} sessionId={sessionId} /> : null}
    </article>
  );
}

export function HomeChat({
  controller,
  createSession,
  onNewSession,
}: {
  controller: VoiceAgentController;
  createSession: (question: string) => Promise<ResearchSession | undefined>;
  onNewSession: () => void;
}) {
  const { userId } = useAuth();
  const { messages, replyPending, error } = controller;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"opening" | "ready" | "saved-chat">("opening");
  const started = useRef(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const question = messages.find((message) => message.role === "student")?.text ?? "New session";
  const latestAnswer = [...messages].reverse().find((message) => message.role === "inko");

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const distance = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    if (distance < 160) thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
  }, [messages, replyPending]);

  useEffect(() => {
    if (!latestAnswer || started.current) return;
    started.current = true;
    const sources = latestAnswer.sources ?? [];
    void (async () => {
      const session = await createSession(studyQuestion(question));
      if (!session) {
        setSessionStatus("saved-chat");
        return;
      }
      if (userId) {
        await Promise.all(sources.map(async (source) => {
          try {
            await createSource(userId, session.id, {
              title: source.title.slice(0, 200),
              url: source.url,
              type: "url",
              tag: "supports",
            });
          } catch {
            // The session still exists when one link is rejected.
          }
        }));
      }
      window.history.replaceState(null, "", "/");
      setSessionId(session.id);
      setSessionStatus("ready");
    })();
  }, [createSession, latestAnswer, question, userId]);

  const title = question.length > 72 ? `${question.slice(0, 72).trim()}…` : question;

  return (
    <div className="home-chat">
      <header className="home-chat-bar">
        <div>
          <span>{sessionStatus === "opening" ? "Opening session…" : sessionStatus === "ready" ? "Session" : "Chat"}</span>
          <h1>{title}</h1>
        </div>
        <button className="home-chat-new" onClick={onNewSession} type="button">
          <Plus aria-hidden="true" size={14} /> New session
        </button>
      </header>

      <div className="home-chat-grid">
        <div className="home-chat-main">
          <div className="home-chat-thread" ref={threadRef}>
            {messages.map((message, index) => (
              <ChatTurn key={message.id} message={message} question={questionBefore(messages, index)} sessionId={sessionId} />
            ))}
            {replyPending ? <ThinkingTurn /> : null}
            {error ? <p className="voice-capsule-error">{error}</p> : null}
          </div>
          <VoiceCapsule compact />
        </div>

        <aside className="home-chat-side" aria-label="Session tools">
          <p className="home-chat-side-status">
            {sessionStatus === "opening" && "Saving this as a research session."}
            {sessionStatus === "ready" && "This chat is a research session. Follow-ups stay here."}
            {sessionStatus === "saved-chat" && "The chat is open. A saved session needs a free account or a free session slot."}
          </p>
          {latestAnswer ? (
            <StudyAnswerCard answer={latestAnswer} panel question={question} sessionId={sessionId} />
          ) : (
            <p className="study-answer-note">Sources and tools show up with the answer.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
