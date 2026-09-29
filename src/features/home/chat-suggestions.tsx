"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { createResearchSession, createSource } from "@/features/research/research-repository";
import { useToasts } from "@/features/toast/toast-provider";
import type { ChatSessionLink, StudySourceLink, VoiceMessage } from "@/features/voice/voice-types";
import { deriveConversationTitle } from "@/lib/chat/conversation-title";
import { inkoFetch } from "@/lib/auth/api-client";
import { upsertLocalRecord } from "@/lib/data/local-store";
import type { Flashcard, Note, Quiz, QuizAnswerKey, QuizQuestion } from "@/lib/data/models";

type PageBriefKind = "debate" | "research" | "quiz" | "flashcards" | "focus";
type PageBriefLike = { kind: PageBriefKind; label: string } | null;

const contextChips: Record<PageBriefKind, string[]> = {
  debate: ["Help me answer this", "Find a source for this claim", "Summarize the other side"],
  research: ["What is still unclear?", "Summarize the evidence", "What should I investigate next?"],
  quiz: ["Quiz me on this", "Explain the hard part", "Give me a hint"],
  flashcards: ["Quiz me on this", "Explain the hard part", "Add more cards on this"],
  focus: ["What should I work on?", "Suggest a study plan", "How am I doing today?"],
};

type SessionToolId = "study" | "research" | "debate" | "cards";

const DRAG_THRESHOLD = 10;

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<Note>;
  return typeof note.id === "string" && typeof note.title === "string" && typeof note.content_markdown === "string";
}

function hasId(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === "object" && "id" in value && typeof value.id === "string");
}

function noteContent(answer: string, sources: StudySourceLink[]) {
  const links = sources.map((source, index) => `${index + 1}. ${source.title} — ${source.url}`).join("\n");
  return links ? `${answer}\n\nSources:\n${links}` : answer;
}

function keepLocal(userId: string, result: Record<string, unknown>) {
  if (result.persisted !== false) return;
  if (isNote(result.note)) upsertLocalRecord("notes", userId, result.note);
  if (Array.isArray(result.cards)) {
    for (const card of result.cards) if (hasId(card)) upsertLocalRecord("flashcards", userId, card as Flashcard);
  }
  if (hasId(result.quiz)) upsertLocalRecord("quizzes", userId, result.quiz as Quiz);
  if (Array.isArray(result.questions)) {
    for (const question of result.questions) if (hasId(question)) upsertLocalRecord("quiz-questions", userId, question as QuizQuestion);
  }
  if (Array.isArray(result.demo_answer_keys)) {
    for (const key of result.demo_answer_keys) if (hasId(key)) upsertLocalRecord("quiz-answer-keys", userId, key as QuizAnswerKey);
  }
}

async function postTool(path: string, body: Record<string, unknown>) {
  const response = await inkoFetch(path, { method: "POST", body: JSON.stringify(body) });
  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, result };
}

/** Pull the latest Q&A and a short topic label from the open chat. */
export function sessionStudyContext(messages: VoiceMessage[], sessionTitle?: string) {
  let answer: VoiceMessage | null = null;
  let question = "";
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const turn = messages[index];
    if (turn.role !== "inko" || turn.text.trim().length < 12) continue;
    answer = turn;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (messages[cursor]?.role === "student") {
        question = messages[cursor].text;
        break;
      }
    }
    break;
  }
  const lastStudent = [...messages].reverse().find((turn) => turn.role === "student")?.text?.trim() ?? "";
  const seed = question || lastStudent || "";
  const titled = sessionTitle && !/^new (chat|conversation)$/i.test(sessionTitle.trim()) ? sessionTitle.trim() : "";
  const topic = (titled || (seed ? deriveConversationTitle(seed) : "")).slice(0, 80);
  return { answer, question: question || lastStudent, topic };
}

const linkKindLabel: Record<ChatSessionLink["kind"], string> = {
  research: "Research",
  debate: "Debate",
  flashcards: "Flashcards",
};

export function sessionLinksFrom(messages: VoiceMessage[]) {
  const seen = new Set<string>();
  const links: ChatSessionLink[] = [];
  for (const message of messages) {
    const link = message.link;
    if (!link || seen.has(`${link.kind}:${link.href}`)) continue;
    seen.add(`${link.kind}:${link.href}`);
    links.push(link);
  }
  return links;
}

export function SessionDirectory({ links }: { links: ChatSessionLink[] }) {
  if (!links.length) return null;
  return (
    <div aria-label="Saved from this chat" className="chat-session-directory">
      {links.map((link) => (
        <Link href={link.href} key={`${link.kind}:${link.href}`}>
          <span>{linkKindLabel[link.kind]}</span>
          <strong>{link.title}</strong>
        </Link>
      ))}
    </div>
  );
}

function clipLabel(prefix: string, topic: string, empty: string) {
  if (!topic) return empty;
  const body = topic.length > 28 ? `${topic.slice(0, 25).trim()}…` : topic;
  return `${prefix} ${body}`;
}

export function ChatSuggestions({
  brief,
  onSend,
  messages = [],
  sessionTitle,
  researchSessionId = null,
  onResearchSessionCreated,
  onPinLink,
}: {
  brief?: PageBriefLike | null;
  onSend?: (text: string) => void;
  messages?: VoiceMessage[];
  sessionTitle?: string;
  researchSessionId?: string | null;
  onResearchSessionCreated?: (id: string) => void;
  onPinLink?: (link: ChatSessionLink) => void;
}) {
  const router = useRouter();
  const { userId } = useAuth();
  const { showToast } = useToasts();
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef({ pointer: -1, x: 0, left: 0, moved: false, capturing: false });
  const noteRef = useRef<{ note: Note; persisted: boolean } | null>(null);
  const [busy, setBusy] = useState<SessionToolId | null>(null);
  const chips = brief ? contextChips[brief.kind] : null;
  const { answer, question, topic } = useMemo(() => sessionStudyContext(messages, sessionTitle), [messages, sessionTitle]);
  const hasTopic = topic.length >= 3;
  const hasAnswer = Boolean(answer && answer.text.trim().length >= 40);

  const sessionTools = useMemo(() => ([
    { id: "study" as const, label: "What should I study today?" },
    { id: "research" as const, label: clipLabel("Research", topic, "Research this chat") },
    { id: "debate" as const, label: clipLabel("Debate", topic, "Debate this chat") },
    { id: "cards" as const, label: "Make flashcards" },
  ]), [topic]);

  useEffect(() => {
    noteRef.current = null;
  }, [answer?.id]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) return;
      let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= el.clientWidth;
      if (!delta) return;
      const next = Math.min(max, Math.max(0, el.scrollLeft + delta));
      if (next === el.scrollLeft) return;
      el.scrollLeft = next;
      event.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || event.button !== 0) return;
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    drag.current = { pointer: event.pointerId, x: event.clientX, left: el.scrollLeft, moved: false, capturing: false };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = scroller.current;
    if (!el || drag.current.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.current.x;
    if (!drag.current.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!drag.current.capturing) {
      drag.current.moved = true;
      drag.current.capturing = true;
      el.dataset.dragging = "true";
      try { el.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    }
    el.scrollLeft = drag.current.left - dx;
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const el = scroller.current;
    if (drag.current.pointer !== event.pointerId) return;
    const wasDragging = drag.current.moved;
    if (drag.current.capturing && el) {
      try { el.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    }
    drag.current.pointer = -1;
    drag.current.capturing = false;
    if (el) delete el.dataset.dragging;
    if (!wasDragging) drag.current.moved = false;
  }

  function onClickCapture(event: React.MouseEvent) {
    if (!drag.current.moved) return;
    drag.current.moved = false;
    event.preventDefault();
    event.stopPropagation();
  }

  const fail = (result: Record<string, unknown>) => {
    const code = typeof result.error === "string" ? result.error : "TOOL_FAILED";
    if (code === "GUEST_LIMIT" || code === "AUTH_REQUIRED") {
      window.dispatchEvent(new Event("inko:guest-limit"));
      showToast({ tone: "info", title: "Create a free account to use study tools." });
      return;
    }
    showToast({ tone: "info", title: "That tool could not finish.", message: "Try again in a moment." });
  };

  const needChat = () => {
    showToast({ tone: "info", title: "Chat about a topic first", message: "Ask Inko something, then use these tools on that session." });
  };

  const ensureNote = async () => {
    if (!userId || !answer) {
      fail({ error: "AUTH_REQUIRED" });
      return null;
    }
    if (noteRef.current) return noteRef.current;
    const outcome = await postTool("/api/study/notes/generate", {
      content: noteContent(answer.text, answer.sources ?? []),
      source: "text",
    });
    if (!outcome.ok || !isNote(outcome.result.note)) {
      fail(outcome.result);
      return null;
    }
    keepLocal(userId, outcome.result);
    const saved = { note: outcome.result.note, persisted: outcome.result.persisted !== false };
    noteRef.current = saved;
    return saved;
  };

  const runSessionTool = async (id: SessionToolId) => {
    if (busy) return;
    if (id === "study") {
      router.push("/progress");
      return;
    }
    if (!hasTopic) {
      needChat();
      return;
    }
    setBusy(id);
    try {
      if (id === "debate") {
        const claim = (question || topic).trim().slice(0, 500);
        const params = new URLSearchParams({ topic: claim.slice(0, 200), claim, mode: "debate", live: "1" });
        const href = `/debate?${params.toString()}`;
        onPinLink?.({ kind: "debate", title: topic, href });
        showToast({ tone: "success", title: "Debate saved in this chat", message: topic });
        return;
      }
      if (id === "research") {
        if (!userId) {
          fail({ error: "AUTH_REQUIRED" });
          return;
        }
        if (researchSessionId) {
          onPinLink?.({ kind: "research", title: topic, href: `/research?session=${encodeURIComponent(researchSessionId)}` });
          showToast({ tone: "success", title: "Research saved in this chat", message: topic });
          return;
        }
        const researchQuestion = (question.trim().length >= 10 ? question : topic).trim().slice(0, 500);
        const session = await createResearchSession(userId, researchQuestion);
        onResearchSessionCreated?.(session.id);
        const sources = answer?.sources ?? [];
        await Promise.all(sources.map(async (source) => {
          try {
            await createSource(userId, session.id, { title: source.title.slice(0, 200), url: source.url, type: "url", tag: "supports" });
          } catch {
            // A rejected link should not drop the research project.
          }
        }));
        onPinLink?.({ kind: "research", title: topic, href: `/research?session=${encodeURIComponent(session.id)}` });
        showToast({ tone: "success", title: "Research saved in this chat", message: topic });
        return;
      }
      if (id === "cards") {
        if (!hasAnswer || !answer) {
          showToast({ tone: "info", title: "Need an Inko answer first", message: "Ask a question in this chat, then make flashcards from the reply." });
          return;
        }
        if (!userId) {
          fail({ error: "AUTH_REQUIRED" });
          return;
        }
        const saved = await ensureNote();
        if (!saved) return;
        const outcome = await postTool("/api/study/flashcards/generate", {
          note_id: saved.note.id,
          ...(saved.persisted ? {} : { note: { id: saved.note.id, title: saved.note.title, content_markdown: saved.note.content_markdown } }),
        });
        if (!outcome.ok) {
          fail(outcome.result);
          return;
        }
        keepLocal(userId, outcome.result);
        onPinLink?.({ kind: "flashcards", title: topic, href: "/flashcards" });
        showToast({ tone: "success", title: "Flashcards saved in this chat", message: topic });
      }
    } catch (caught) {
      fail({ error: caught instanceof Error ? caught.message : "TOOL_FAILED" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      aria-label="Suggested tools"
      className="chat-suggestions"
      onClickCapture={onClickCapture}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      ref={scroller}
    >
      {chips
        ? chips.map((label) => (
          <button className="chat-suggestion-btn" key={label} onClick={() => onSend?.(label)} type="button">{label}</button>
        ))
        : sessionTools.map((item) => (
          <button
            className="chat-suggestion-btn"
            disabled={busy !== null}
            key={item.id}
            onClick={() => void runSessionTool(item.id)}
            title={hasTopic ? `Use this chat: ${topic}` : "Chat about a topic first"}
            type="button"
          >
            {busy === item.id ? "Working…" : item.label}
          </button>
        ))}
    </div>
  );
}
