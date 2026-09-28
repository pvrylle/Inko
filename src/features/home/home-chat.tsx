"use client";

import { ArrowUp, Check, History, MoreHorizontal, Plus, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useOptionalProjects } from "@/features/projects/project-provider";
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
  const isInko = message.role === "inko";
  const sources = message.sources ?? [];
  return (
    <article className="assistant-turn" data-role={message.role}>
      <span className="assistant-turn-speaker">{isInko ? "Inko" : "You"}</span>
      {isInko ? <StudyAnswerText sources={sources} text={message.text} /> : <p>{message.text}</p>}
      {isInko && sources.length > 0 ? (
        <details className="assistant-turn-more">
          <summary>{sources.length} sources and actions</summary>
          <ul>
            {sources.map((source, index) => (
              <li key={`${source.url}-${index}`}><a href={source.url} rel="noopener noreferrer" target="_blank">{source.title}</a></li>
            ))}
          </ul>
          <AnswerToolIcons answer={message} question={question} sessionId={sessionId} onResearchSessionCreated={onResearchSessionCreated} />
        </details>
      ) : null}
    </article>
  );
}

export function HomeChat({ controller, home = false, onClose }: { controller: VoiceAgentController; home?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const { state } = useMascot();
  const projects = useOptionalProjects();
  const { messages, replyPending, error, activeSessionId } = controller;
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const active = controller.sessions.find((session) => session.id === activeSessionId);
  const visibleSessions = controller.sessions.filter((session) => !session.archived_at && (projects?.conversationProjects[session.id] ?? null) === (projects?.activeId ?? null));
  const status = error ? "Needs attention" : replyPending ? "Thinking" : controller.connection === "connected" ? "Listening" : "Ready";

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [activeSessionId, messages.length]);

  const newConversation = () => {
    controller.clearConversation();
    setDraft("");
    setHistoryOpen(false);
    router.push("/");
  };

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
    <section className="assistant-panel" aria-label="Inko assistant">
      <header className="assistant-panel-header">
        <div><strong title={active?.title || "Inko"}>{active?.title || "Inko"}</strong><span><i data-status={status} />{status}</span></div>
        <div className="assistant-panel-actions">
          <button aria-label={historyOpen ? "Hide conversations" : "Show conversations"} aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)} title="Conversations" type="button"><History size={18} /></button>
          <button aria-label="New conversation" onClick={newConversation} title="New conversation" type="button"><Plus size={18} /></button>
          {onClose ? <button aria-label="Close assistant" className="assistant-close" onClick={onClose} title="Close assistant" type="button"><X size={18} /></button> : null}
        </div>
      </header>

      {historyOpen ? (
        <div className="assistant-history" aria-label="Conversations">
          <div className="assistant-history-heading"><strong>Conversations</strong><span>{visibleSessions.length}</span></div>
          {controller.sessionError ? <p className="assistant-history-error" role="status">{controller.sessionError}</p> : null}
          {visibleSessions.length === 0 ? <p className="assistant-history-empty">No conversations yet.</p> : null}
          {visibleSessions.map((session) => (
            <div className="assistant-history-row" key={session.id}>
              {editingId === session.id ? (
                <form onSubmit={(event) => { event.preventDefault(); if (draftTitle.trim()) controller.renameConversation(session.id, draftTitle); setEditingId(null); }}>
                  <input aria-label="Conversation title" autoFocus maxLength={160} onChange={(event) => setDraftTitle(event.target.value)} value={draftTitle} />
                  <button aria-label="Save title" type="submit"><Check size={15} /></button>
                  <button aria-label="Cancel rename" onClick={() => setEditingId(null)} type="button"><X size={15} /></button>
                </form>
              ) : deleteId === session.id ? (
                <div className="assistant-history-confirm"><span>Delete this conversation?</span><button onClick={() => setDeleteId(null)} type="button">Cancel</button><button onClick={() => { controller.removeConversation(session.id); setDeleteId(null); }} type="button">Delete</button></div>
              ) : (
                <>
                  <button aria-current={activeSessionId === session.id ? "true" : undefined} className="assistant-history-item" onClick={() => { controller.openConversation(session.id); setHistoryOpen(false); }} type="button">{session.title || "New conversation"}</button>
                  <details className="assistant-history-options">
                    <summary aria-label={`Options for ${session.title || "New conversation"}`} title="Conversation options"><MoreHorizontal size={17} /></summary>
                    <div>
                      <button onClick={() => { setDraftTitle(session.title || "New conversation"); setEditingId(session.id); }} type="button">Rename</button>
                      <button onClick={() => controller.archiveConversation(session.id)} type="button">Archive</button>
                      <button onClick={() => setDeleteId(session.id)} type="button">Delete</button>
                      {projects && projects.projects.length > 0 ? (
                        <label>Project
                          <select aria-label={`Project for ${session.title || "New conversation"}`} onChange={(event) => projects.assignConversation(session.id, event.target.value || null)} value={projects.conversationProjects[session.id] ?? ""}>
                            <option value="">No project</option>
                            {projects.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </details>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="assistant-character">
            <InkoMascot className="assistant-character-mascot" fit="contain" state={state} />
            <span aria-live="polite">{status === "Ready" ? "Here with you" : status}</span>
          </div>
          {home ? (
            <div className="assistant-live" aria-live="polite">
              <span>{controller.partialTranscript ? replyPending ? "Inko" : "Hearing you" : replyPending ? "Thinking" : "Voice companion"}</span>
              <p>{controller.partialTranscript || (replyPending ? "Working through your question..." : "I'm here whenever you need me.")}</p>
              {error ? <p className="assistant-error" role="status">{error}</p> : null}
            </div>
          ) : (
            <div className="assistant-thread" ref={threadRef}>
              {messages.length === 0 ? <p className="assistant-empty">Tell me what you want to work on.</p> : null}
              {messages.map((message, index) => (
                <ChatTurn key={message.id} message={message} question={questionBefore(messages, index)} sessionId={active?.research_session_id ?? null} onResearchSessionCreated={controller.linkResearchSession} />
              ))}
              {replyPending ? <p aria-live="polite" className="assistant-pending">Inko is thinking...</p> : null}
              {error ? <p className="assistant-error" role="status">{error}</p> : null}
            </div>
          )}
        </>
      )}

      <div className="assistant-composer-area">
        {!home ? <form className="assistant-composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="assistant-input">Message Inko</label>
          <textarea id="assistant-input" maxLength={4000} onChange={(event) => setDraft(event.target.value)} onKeyDown={onDraftKeyDown} placeholder="Ask or tell Inko anything" rows={2} value={draft} />
          <button aria-label="Send message" disabled={!draft.trim() || replyPending} title="Send message" type="submit"><ArrowUp size={19} /></button>
        </form> : null}
        <VoiceCapsule compact />
      </div>
    </section>
  );
}
