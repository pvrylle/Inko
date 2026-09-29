"use client";

import { BrainCircuit, Layers3, LayoutGrid, Search, StickyNote, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/providers/auth-provider";
import { createResearchSession, createSource, upsertCanvasNote } from "@/features/research/research-repository";
import { useToasts } from "@/features/toast/toast-provider";
import type { StudySourceLink, VoiceMessage } from "@/features/voice/voice-types";
import { inkoFetch } from "@/lib/auth/api-client";
import { upsertLocalRecord } from "@/lib/data/local-store";
import type { Flashcard, FocusSession, Note, Quiz, QuizAnswerKey, QuizQuestion } from "@/lib/data/models";
import { inlineMarkdown } from "@/components/ui/inline-markdown";
import { suggestStudyTools, type StudyToolId } from "./suggest-study-tools";

type ToolId = StudyToolId;

const tools: Array<{ id: ToolId; label: string; Icon: typeof StickyNote }> = [
  { id: "note", label: "Note", Icon: StickyNote },
  { id: "cards", label: "Cards", Icon: Layers3 },
  { id: "quiz", label: "Quiz", Icon: BrainCircuit },
  { id: "research", label: "Research", Icon: Search },
  { id: "canvas", label: "Canvas", Icon: LayoutGrid },
  { id: "focus", label: "Focus", Icon: Timer },
];

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function studyQuestion(question: string, answer: string) {
  const asked = question.trim();
  if (asked.length >= 10) return asked.slice(0, 500);
  const fallback = answer.replace(/\s*\[\d+\]/g, "").trim().slice(0, 180);
  return fallback.length >= 10 ? fallback : "Study this topic from the sources Inko found.";
}

function noteContent(answer: string, sources: StudySourceLink[]) {
  const links = sources.map((source, index) => `${index + 1}. ${source.title} — ${source.url}`).join("\n");
  return links ? `${answer}\n\nSources:\n${links}` : answer;
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<Note>;
  return typeof note.id === "string" && typeof note.title === "string" && typeof note.content_markdown === "string";
}

function hasId(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === "object" && "id" in value && typeof value.id === "string");
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
  if (hasId(result.previous_session)) upsertLocalRecord("focus-sessions", userId, result.previous_session as FocusSession);
  if (hasId(result.session)) upsertLocalRecord("focus-sessions", userId, result.session as FocusSession);
}

async function postTool(path: string, body: Record<string, unknown>) {
  const response = await inkoFetch(path, { method: "POST", body: JSON.stringify(body) });
  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, result };
}

export function StudyAnswerText({ text, sources }: { text: string; sources: StudySourceLink[] }) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const paragraphs = blocks.length > 0 ? blocks : [text];
  return (
    <>
      {paragraphs.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const isList = lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line));
        if (isList) {
          return (
            <ul key={index}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderStudyInline(line.replace(/^[-*]\s+/, ""), sources)}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{renderStudyInline(lines.join(" "), sources)}</p>;
      })}
    </>
  );
}

function renderStudyInline(text: string, sources: StudySourceLink[]) {
  return inlineMarkdown(text, (label, index) => {
    const source = sources[Number(label) - 1];
    if (!source) return <span key={index}>[{label}]</span>;
    return (
      <a key={index} className="study-cite" href={source.url} rel="noopener noreferrer" target="_blank">
        {label}
      </a>
    );
  });
}

function useStudyToolRunner(answer: VoiceMessage, question: string, sessionId: string | null, onResearchSessionCreated?: (id: string) => void) {
  const router = useRouter();
  const { userId } = useAuth();
  const { showToast } = useToasts();
  const [busy, setBusy] = useState<ToolId | null>(null);
  const noteRef = useRef<{ note: Note; persisted: boolean } | null>(null);
  const sessionRef = useRef<string | null>(null);
  const sources = answer.sources ?? [];

  const fail = (result: Record<string, unknown>) => {
    const code = typeof result.error === "string" ? result.error : "TOOL_FAILED";
    if (code === "GUEST_LIMIT" || code === "AUTH_REQUIRED") {
      window.dispatchEvent(new Event("inko:guest-limit"));
      showToast({ tone: "info", title: "Create a free account to use study tools." });
      return;
    }
    showToast({ tone: "info", title: "That tool could not finish.", message: "Try again in a moment." });
  };

  const ensureNote = async () => {
    if (!userId) {
      fail({ error: "AUTH_REQUIRED" });
      return null;
    }
    if (noteRef.current) return noteRef.current;
    const outcome = await postTool("/api/study/notes/generate", {
      content: noteContent(answer.text, sources),
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

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    if (!userId) {
      fail({ error: "AUTH_REQUIRED" });
      return null;
    }
    if (sessionRef.current) return sessionRef.current;
    const session = await createResearchSession(userId, studyQuestion(question, answer.text));
    sessionRef.current = session.id;
    onResearchSessionCreated?.(session.id);
    await Promise.all(sources.map(async (source) => {
      try {
        await createSource(userId, session.id, { title: source.title.slice(0, 200), url: source.url, type: "url", tag: "supports" });
      } catch {
        // A rejected link should not drop the research project.
      }
    }));
    return session.id;
  };

  const run = async (id: ToolId) => {
    if (busy) return;
    setBusy(id);
    try {
      if (id === "note") {
        const saved = await ensureNote();
        if (saved) showToast({ tone: "success", title: "Note saved", message: saved.note.title });
        return;
      }
      if (id === "cards" || id === "quiz") {
        const saved = await ensureNote();
        if (!saved || !userId) return;
        const path = id === "cards" ? "/api/study/flashcards/generate" : "/api/study/quizzes/generate";
        const outcome = await postTool(path, {
          note_id: saved.note.id,
          ...(saved.persisted ? {} : { note: { id: saved.note.id, title: saved.note.title, content_markdown: saved.note.content_markdown } }),
        });
        if (!outcome.ok) {
          fail(outcome.result);
          return;
        }
        keepLocal(userId, outcome.result);
        showToast({ tone: "success", title: id === "cards" ? "Flashcards ready" : "Quiz ready" });
        router.push(id === "cards" ? "/flashcards" : "/quiz");
        return;
      }
      if (id === "focus") {
        if (!userId) {
          fail({ error: "AUTH_REQUIRED" });
          return;
        }
        const outcome = await postTool("/api/study/focus/start", { minutes: 25 });
        if (!outcome.ok) {
          fail(outcome.result);
          return;
        }
        keepLocal(userId, outcome.result);
        showToast({ tone: "success", title: "25 minute focus started" });
        router.push("/focus");
        return;
      }
      const sessionId = await ensureSession();
      if (!sessionId || !userId) return;
      if (id === "canvas") {
        const markdown = [`# Study answer`, "", answer.text, "", "## Sources", ...sources.map((source, index) => `${index + 1}. [${source.title}](${source.url})`)].join("\n");
        await upsertCanvasNote(userId, sessionId, markdown);
        showToast({ tone: "success", title: "Added to the canvas" });
        router.push(`/research?session=${sessionId}`);
        return;
      }
      showToast({ tone: "success", title: "Research project opened" });
      router.push(`/research?session=${sessionId}`);
    } catch (caught) {
      fail({ error: caught instanceof Error ? caught.message : "TOOL_FAILED" });
    } finally {
      setBusy(null);
    }
  };

  return { busy, run };
}

function FloatingToolHint({ label, hint, anchor }: { label: string; hint: string; anchor: HTMLButtonElement }) {
  const [place, setPlace] = useState({ top: 0, left: 0, arrow: 18, above: true });

  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const width = 220;
      const column = anchor.closest(".home-chat-main")?.getBoundingClientRect();
      const minLeft = Math.max(12, column?.left ?? 12);
      const maxRight = (column?.right ?? window.innerWidth) - 12;
      const preferred = rect.left + rect.width / 2 - width / 2;
      const left = Math.min(Math.max(minLeft, preferred), Math.max(minLeft, maxRight - width));
      const arrow = Math.min(width - 18, Math.max(12, rect.left + rect.width / 2 - left - 6));
      const above = rect.top > 88;
      const top = above ? rect.top - 10 : rect.bottom + 10;
      setPlace((current) => (
        current.top === top && current.left === left && current.arrow === arrow && current.above === above
          ? current
          : { top, left, arrow, above }
      ));
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [anchor]);

  return createPortal(
    <span
      className="home-turn-tool-tip"
      data-placement={place.above ? "above" : "below"}
      role="tooltip"
      style={{ top: place.top, left: place.left, "--tip-arrow": `${place.arrow}px` } as React.CSSProperties}
    >
      <strong>{label}</strong>
      {hint}
    </span>,
    document.body,
  );
}

export function AnswerToolIcons({
  answer,
  question,
  sessionId = null,
  onResearchSessionCreated,
}: {
  answer: VoiceMessage;
  question: string;
  sessionId?: string | null;
  onResearchSessionCreated?: (id: string) => void;
}) {
  const { busy, run } = useStudyToolRunner(answer, question, sessionId, onResearchSessionCreated);
  const suggestions = suggestStudyTools(question, answer.text, answer.sources?.length ?? 0);
  const [open, setOpen] = useState<{ id: string; label: string; hint: string; anchor: HTMLButtonElement } | null>(null);
  const closeTimer = useRef<number | null>(null);
  const showTip = (next: { id: string; label: string; hint: string; anchor: HTMLButtonElement }) => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setOpen(next);
  };
  const hideTip = (id: string) => {
    closeTimer.current = window.setTimeout(() => {
      setOpen((current) => (current?.id === id ? null : current));
    }, 90);
  };
  return (
    <div className="home-turn-tools" aria-label="Suggested study tools">
      {suggestions.map((suggestion) => {
        const tool = tools.find((item) => item.id === suggestion.id);
        if (!tool) return null;
        const { Icon } = tool;
        return (
          <button
            key={suggestion.id}
            className="home-turn-tool"
            type="button"
            disabled={busy !== null}
            data-busy={busy === suggestion.id}
            aria-label={`${tool.label}. ${suggestion.hint}`}
            onClick={() => void run(suggestion.id)}
            onMouseEnter={(event) => showTip({ id: suggestion.id, label: tool.label, hint: suggestion.hint, anchor: event.currentTarget })}
            onMouseLeave={() => hideTip(suggestion.id)}
            onFocus={(event) => showTip({ id: suggestion.id, label: tool.label, hint: suggestion.hint, anchor: event.currentTarget })}
            onBlur={() => hideTip(suggestion.id)}
          >
            <Icon aria-hidden="true" size={15} />
          </button>
        );
      })}
      {open ? <FloatingToolHint anchor={open.anchor} hint={open.hint} label={open.label} /> : null}
    </div>
  );
}

export function StudyAnswerCard({
  answer,
  question,
  panel = false,
  sessionId = null,
}: {
  answer: VoiceMessage;
  question: string;
  panel?: boolean;
  sessionId?: string | null;
}) {
  const { busy, run } = useStudyToolRunner(answer, question, sessionId);
  const sources = answer.sources ?? [];

  return (
    <article className={panel ? "study-panel" : "study-answer"} aria-live="polite">
      {panel ? null : (
        <header>
          <span>Study answer</span>
        </header>
      )}
      {panel ? null : <StudyAnswerText sources={sources} text={answer.text} />}
      {panel && sources.length > 0 ? <h2>Sources</h2> : null}
      {sources.length > 0 ? (
        <div className="study-sources">
          {sources.map((source, index) => (
            <a key={source.url} className="study-source" href={source.url} rel="noopener noreferrer" target="_blank">
              <small>{index + 1} · {hostOf(source.url)}</small>
              <strong>{source.title}</strong>
            </a>
          ))}
        </div>
      ) : (
        <p className="study-answer-note">No source links came back for this question.</p>
      )}
      <div className="study-tools" aria-label="Study tools">
        {tools.map(({ id, label, Icon }) => (
          <button key={id} className="study-tool" data-busy={busy === id} disabled={busy !== null} onClick={() => void run(id)} type="button">
            <Icon aria-hidden="true" size={14} />
            {busy === id ? "Working…" : label}
          </button>
        ))}
      </div>
    </article>
  );
}
