"use client";

import { ArrowLeft, ArrowRight, MessageSquareText, Mic, Send, Square, User } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentTopbar } from "@/components/layout/content-topbar";
import { useAuth } from "@/components/providers/auth-provider";
import { StudyAnswerText } from "@/features/home/study-answer-card";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useOptionalProjects } from "@/features/projects/project-provider";
import { getResearchSession, listContradictions, listFindings, listSources } from "@/features/research/research-repository";
import { getLocalResearchProject } from "@/lib/data/research-local";
import { inkoFetch } from "@/lib/auth/api-client";
import { usePublishBrief } from "@/features/page-brief/page-brief";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import { speakInkoLine, stopInkoSpeech } from "@/features/voice/speak-text";
import { prepareAnnaSpeech } from "@/lib/voice/speak-script";
import { getDebate, listDebates, saveDebate, type SavedDebate } from "./debate-archive";
import { buildDebateEvidence, type DebateEvidence } from "./debate-evidence";
import { useDebateMic } from "./use-debate-mic";

export type DebateMode = "debate" | "socratic" | "defense";

type DebateTurn = { role: "student" | "inko"; text: string };
type DebateVerdict = { conceded: string; unanswered: string; nextStep: string };
type EvidenceState = "idle" | "loading" | "ready";

const MODES: { id: DebateMode; title: string; detail: string }[] = [
  { id: "debate", title: "Debate", detail: "You defend. Inko takes the other side." },
  { id: "socratic", title: "Socratic", detail: "Only questions. No answers." },
  { id: "defense", title: "Defense", detail: "The hardest objection from your research." },
];

function isMode(value: string): value is DebateMode {
  return value === "debate" || value === "socratic" || value === "defense";
}

function DebateBubble({ role, text, pending = false }: { role: "student" | "inko"; text: string; pending?: boolean }) {
  const { state } = useMascot();
  const inko = role === "inko";
  return (
    <article className="assistant-turn" data-role={role}>
      {inko ? <InkoMascot className="assistant-chat-mascot" fit="contain" state={state} /> : null}
      <div className="assistant-bubble">
        <span className="assistant-turn-speaker">{inko ? "Inko" : "You"}</span>
        {pending ? <p className="assistant-pending">Inko is thinking...</p> : inko ? <StudyAnswerText sources={[]} text={text} /> : <p>{text}</p>}
      </div>
      {inko ? null : <span className="assistant-chat-head" aria-hidden="true"><User size={16} /></span>}
    </article>
  );
}

function ResearchPack({
  sessionId,
  evidence,
  evidenceState,
  question,
}: {
  sessionId: string;
  evidence: DebateEvidence[];
  evidenceState: EvidenceState;
  question: string;
}) {
  if (!sessionId) return <p className="debate-evidence-note">This debate is not tied to a research session.</p>;
  const sources = evidence.filter((item) => item.kind === "source");
  const findings = evidence.filter((item) => item.kind === "finding");
  return (
    <section className="debate-session-pack" aria-label="Research sources">
      <p className="debate-evidence-note">
        {evidenceState === "loading"
          ? "Loading sources from this research session…"
          : sources.length
            ? `Using ${sources.length} source${sources.length === 1 ? "" : "s"} and ${findings.length} finding${findings.length === 1 ? "" : "s"} from this research session. Inko argues from these on every turn.`
            : "This research session has no sources yet. Inko will say so instead of inventing one."}
      </p>
      {question ? <p className="debate-evidence-note">{question}</p> : null}
      {sources.length ? (
        <ul className="debate-source-list">
          {sources.map((source, index) => (
            <li data-tag={source.tag} key={`${source.text}-${index}`}>{source.text}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function DebateArchive({
  related,
  others,
  onOpen,
  onOpenChat,
}: {
  related: SavedDebate[];
  others: SavedDebate[];
  onOpen: (item: SavedDebate) => void;
  onOpenChat: (item: SavedDebate) => void;
}) {
  if (related.length + others.length === 0) {
    return <p className="debate-evidence-note">Previous debates will be saved here with their research and chat.</p>;
  }
  const rows = (items: SavedDebate[]) => items.map((item) => (
    <article className="debate-saved" key={item.id}>
      <button onClick={() => onOpen(item)} type="button">
        <strong>{item.claim}</strong>
        <small>{item.turns.length} turn{item.turns.length === 1 ? "" : "s"}</small>
      </button>
      <p>
        {item.researchSessionId ? <Link href={`/research?session=${encodeURIComponent(item.researchSessionId)}&tab=findings`}>{item.researchQuestion || "Research"}</Link> : <span>No research</span>}
        {item.chatSessionId ? <button onClick={() => onOpenChat(item)} type="button">{item.chatTitle || "Open chat"}</button> : <span>No chat</span>}
      </p>
    </article>
  ));
  return (
    <section className="debate-archive" aria-label="Previous debates">
      {related.length ? <><h2>Debates on this research</h2>{rows(related)}</> : null}
      {others.length ? <><h2>Previous debates</h2>{rows(others)}</> : null}
    </section>
  );
}

export function DebateView({
  initialTopic = "",
  initialClaim = "",
  initialMode = "debate",
  initialLive = false,
  initialDebateId = "",
  sessionId = "",
}: {
  initialTopic?: string;
  initialClaim?: string;
  initialMode?: DebateMode;
  initialLive?: boolean;
  initialDebateId?: string;
  sessionId?: string;
}) {
  const router = useRouter();
  const projects = useOptionalProjects();
  const voice = useOptionalVoiceAgent();
  const { userId } = useAuth();
  const [mode, setMode] = useState<DebateMode>(isMode(initialMode) ? initialMode : "debate");
  const [position, setPosition] = useState(initialClaim || initialTopic);
  const [started, setStarted] = useState(initialLive || Boolean(initialDebateId));
  const [argument, setArgument] = useState("");
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [evidence, setEvidence] = useState<DebateEvidence[]>([]);
  const [evidenceState, setEvidenceState] = useState<EvidenceState>(sessionId ? "loading" : "idle");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [debateId, setDebateId] = useState(initialDebateId);
  const [linkedResearchId, setLinkedResearchId] = useState(sessionId);
  const [saved, setSaved] = useState<SavedDebate[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState("");
  const [verdict, setVerdict] = useState<DebateVerdict | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const resumeMicRef = useRef(false);
  const recordRef = useRef<SavedDebate | null>(null);
  pendingRef.current = pending;

  useEffect(() => {
    if (initialDebateId) return;
    setStarted(initialLive);
    if (initialLive) return;
    setMode(isMode(initialMode) ? initialMode : "debate");
    setPosition(initialClaim || initialTopic);
    setTurns([]);
    setDebateId("");
    setVerdict(null);
    setError(null);
  }, [initialClaim, initialDebateId, initialLive, initialMode, initialTopic]);

  useEffect(() => {
    if (!userId) return;
    setSaved(listDebates(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId || !initialDebateId) return;
    const stored = getDebate(userId, initialDebateId);
    if (!stored) return;
    setDebateId(stored.id);
    setMode(stored.mode);
    setPosition(stored.claim);
    setTurns(stored.turns);
    setChatSessionId(stored.chatSessionId);
    setChatTitle(stored.chatTitle);
    if (stored.researchSessionId) setLinkedResearchId(stored.researchSessionId);
    if (!sessionId && stored.researchQuestion) setResearchQuestion(stored.researchQuestion);
    setStarted(true);
    recordRef.current = stored;
  }, [initialDebateId, sessionId, userId]);

  useEffect(() => {
    if (!sessionId || !userId) return;
    let cancelled = false;
    setEvidenceState("loading");
    void (async () => {
      let sources: Awaited<ReturnType<typeof listSources>> = [];
      let findings: Awaited<ReturnType<typeof listFindings>> = [];
      let contradictions: Awaited<ReturnType<typeof listContradictions>> = [];
      let question = "";
      try {
        const [loadedSources, loadedFindings, loadedContradictions, session] = await Promise.all([
          listSources(userId, sessionId),
          listFindings(userId, sessionId),
          listContradictions(userId, sessionId),
          getResearchSession(userId, sessionId),
        ]);
        sources = loadedSources;
        findings = loadedFindings;
        contradictions = loadedContradictions;
        question = session?.question?.trim() ?? "";
      } catch {
        sources = [];
        findings = [];
        contradictions = [];
      }
      const local = getLocalResearchProject(userId, sessionId);
      if (sources.length === 0 && local) sources = local.sources;
      if (findings.length === 0 && local) findings = local.findings;
      if (contradictions.length === 0 && local) contradictions = local.contradictions;
      if (!question && local) question = local.session.question.trim();
      if (cancelled) return;
      setResearchQuestion(question);
      setEvidence(buildDebateEvidence({ sources, findings, contradictions }));
      setEvidenceState("ready");
    })();
    return () => { cancelled = true; };
  }, [sessionId, userId]);

  const debateDetail = started
    ? `Mode: ${mode}. Claim: ${position.slice(0, 300)}.\n\nRecent turns:\n${turns.slice(-4).map((turn) => `${turn.role === "student" ? "Student" : "Inko"}: ${turn.text}`).join("\n")}`.slice(0, 2000)
    : null;
  usePublishBrief(started ? { kind: "debate", label: `Debating: ${position.slice(0, 80)}`, detail: debateDetail ?? "" } : null);

  const remember = (nextTurns: DebateTurn[], id = debateId) => {
    if (!userId || !id) return;
    const now = new Date().toISOString();
    const record: SavedDebate = {
      id,
      claim: position.trim().slice(0, 500),
      mode,
      researchSessionId: sessionId || recordRef.current?.researchSessionId || null,
      researchQuestion: (researchQuestion || recordRef.current?.researchQuestion || "").slice(0, 500),
      chatSessionId: chatSessionId ?? recordRef.current?.chatSessionId ?? null,
      chatTitle: (chatTitle || recordRef.current?.chatTitle || "").slice(0, 160),
      turns: nextTurns.slice(-40),
      createdAt: recordRef.current?.createdAt ?? now,
      updatedAt: now,
    };
    recordRef.current = record;
    saveDebate(userId, record);
    setSaved(listDebates(userId));
  };

  const speakReply = (text: string) => {
    const spoken = prepareAnnaSpeech(text).slice(0, 8_000);
    if (!spoken) return;
    stopInkoSpeech();
    void speakInkoLine(spoken).then((played) => {
      if (played && resumeMicRef.current) startMicRef.current();
    });
  };

  const sendTurn = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pendingRef.current) return;
    const activeId = debateId || crypto.randomUUID();
    if (!debateId) setDebateId(activeId);
    setArgument("");
    setError(null);
    pendingRef.current = true;
    setPending(true);
    const history = turns.slice(-12);
    const withStudent: DebateTurn[] = [...turns, { role: "student", text: trimmed }];
    setTurns(withStudent);
    remember(withStudent, activeId);
    try {
      const response = await inkoFetch("/api/debate", {
        method: "POST",
        body: JSON.stringify({
          mode,
          topic: position.slice(0, 200),
          question: researchQuestion.slice(0, 500),
          argument: trimmed,
          history,
          evidence,
        }),
        signal: AbortSignal.timeout(22_000),
      });
      const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string; verdict?: DebateVerdict | null };
      if (!response.ok || !payload.text) {
        setTurns(turns);
        remember(turns, activeId);
        const message = payload.error === "GUEST_LIMIT"
          ? "Guest limit reached. Create a free account to keep going."
          : "Inko couldn't answer that turn. Try again.";
        setError(message);
        resumeMicRef.current = false;
        return;
      }
      const withReply: DebateTurn[] = [...withStudent, { role: "inko", text: payload.text }];
      setTurns(withReply);
      remember(withReply, activeId);
      if (payload.verdict?.conceded && payload.verdict.unanswered && payload.verdict.nextStep) setVerdict(payload.verdict);
      speakReply(payload.text);
    } catch {
      setTurns(turns);
      remember(turns, activeId);
      setError("Inko couldn't answer that turn. Try again.");
      resumeMicRef.current = false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const sendTurnRef = useRef(sendTurn);
  sendTurnRef.current = sendTurn;
  const startMicRef = useRef(() => {});
  const stopMicRef = useRef(() => {});
  const mic = useDebateMic((text) => {
    if (pendingRef.current) return;
    resumeMicRef.current = true;
    stopMicRef.current();
    void sendTurnRef.current(text);
  });
  startMicRef.current = mic.start;
  stopMicRef.current = mic.stop;

  useEffect(() => () => { stopInkoSpeech(); }, []);

  const begin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const claim = position.trim().slice(0, 500);
    if (!claim || evidenceState === "loading") return;
    const topic = claim.slice(0, 200);
    const id = crypto.randomUUID();
    const activeChat = voice?.activeSessionId ?? null;
    const activeTitle = voice?.sessions.find((item) => item.id === activeChat)?.title?.trim().slice(0, 160) ?? "";
    const now = new Date().toISOString();
    const record: SavedDebate = {
      id,
      claim,
      mode,
      researchSessionId: sessionId || null,
      researchQuestion: researchQuestion.slice(0, 500),
      chatSessionId: activeChat,
      chatTitle: activeTitle,
      turns: [],
      createdAt: now,
      updatedAt: now,
    };
    recordRef.current = record;
    if (userId) {
      saveDebate(userId, record);
      setSaved(listDebates(userId));
    }
    const params = new URLSearchParams({ id, topic, mode, claim, live: "1" });
    if (sessionId) params.set("session", sessionId);
    const href = `/debate?${params.toString()}`;
    router.push(href);
    projects?.addActivity("debate", topic, href);
    voice?.pinSessionLink({ kind: "debate", title: topic, href });
    setDebateId(id);
    setLinkedResearchId(sessionId);
    setChatSessionId(activeChat);
    setChatTitle(activeTitle);
    setPosition(claim);
    setStarted(true);
    setTurns([]);
    setVerdict(null);
    setError(null);
  };

  const submitArgument = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resumeMicRef.current = false;
    mic.stop();
    void sendTurn(argument);
  };

  const reset = () => {
    resumeMicRef.current = false;
    mic.stop();
    stopInkoSpeech();
    setStarted(false);
    setTurns([]);
    setDebateId("");
    setVerdict(null);
    setError(null);
    router.push("/debate");
  };

  const openSaved = (item: SavedDebate) => {
    const params = new URLSearchParams({
      id: item.id,
      live: "1",
      mode: item.mode,
      claim: item.claim.slice(0, 500),
      topic: item.claim.slice(0, 200),
    });
    if (item.researchSessionId) params.set("session", item.researchSessionId);
    router.push(`/debate?${params.toString()}`);
  };

  const related = sessionId ? saved.filter((item) => item.researchSessionId === sessionId) : [];
  const otherDebates = saved.filter((item) => item.researchSessionId !== sessionId);

  return (
    <div className="activity-workspace page-enter">
      <ContentTopbar />
      <div className="activity-content">
        <header className="activity-heading">
          <div className="debate-nav-row">
            {linkedResearchId ? (
              <Link className="debate-back" href={`/research?session=${encodeURIComponent(linkedResearchId)}&tab=findings`}><ArrowLeft size={16} /> Back to research</Link>
            ) : (
              <button className="debate-back" onClick={() => router.back()} type="button"><ArrowLeft size={16} /> Back</button>
            )}
          </div>
          <span className="workspace-eyebrow">Debate</span>
          <h1>{started ? position : "Argue it out"}</h1>
          <p>{started ? MODES.find((item) => item.id === mode)?.detail : "Pick a mode, then state the position you want to defend."}</p>
        </header>
        {!started ? (
          <>
          <form className="debate-topic-form" onSubmit={begin}>
            <div className="debate-modes" role="radiogroup" aria-label="Debate mode">
              {MODES.map((item) => (
                <button aria-pressed={mode === item.id} className="debate-mode" data-active={mode === item.id ? "true" : undefined} key={item.id} onClick={() => setMode(item.id)} type="button">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </button>
              ))}
            </div>
            <label htmlFor="debate-position">Your position</label>
            <textarea className="debate-position" id="debate-position" maxLength={500} onChange={(event) => setPosition(event.target.value)} placeholder="AI tutors improve student learning outcomes." required rows={3} value={position} />
            <ResearchPack evidence={evidence} evidenceState={evidenceState} question={researchQuestion} sessionId={sessionId} />
            <div><button disabled={evidenceState === "loading"} type="submit">Start <ArrowRight size={17} /></button></div>
          </form>
          <DebateArchive onOpen={openSaved} onOpenChat={(item) => { if (!item.chatSessionId) return; voice?.openConversation(item.chatSessionId); router.push("/"); }} others={otherDebates} related={related} />
          </>
        ) : (
          <>
            <ResearchPack evidence={evidence} evidenceState={evidenceState} question={researchQuestion} sessionId={sessionId} />
            <div className="debate-thread" aria-live="polite">
              {turns.length === 0 && !pending ? <p className="debate-evidence-note">Make your opening argument below.</p> : turns.map((turn, index) => (
                <DebateBubble key={`${turn.role}-${index}`} role={turn.role} text={turn.text} />
              ))}
              {pending ? <DebateBubble pending role="inko" text="" /> : null}
            </div>
            {verdict ? (
              <section className="debate-verdict" aria-label="Verdict">
                <h2>Verdict</h2>
                <p><strong>Conceded. </strong>{verdict.conceded}</p>
                <p><strong>Still open. </strong>{verdict.unanswered}</p>
                <p><strong>Next. </strong>{verdict.nextStep}</p>
                {sessionId ? <Link href={`/research?session=${encodeURIComponent(sessionId)}`}>Back to research</Link> : null}
              </section>
            ) : null}
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <form className="debate-argument-form" onSubmit={submitArgument}>
              <label htmlFor="debate-argument">{mic.listening ? "Listening — pause and Inko answers out loud" : "Your argument"}</label>
              <textarea id="debate-argument" maxLength={4000} onChange={(event) => setArgument(event.target.value)} placeholder="I think..." readOnly={mic.listening} rows={4} value={mic.listening ? mic.partial : argument} />
              {mic.error ? <p className="form-error" role="alert">{mic.error}</p> : null}
              <div>
                <button className="workspace-command" disabled={mic.listening || !argument.trim() || pending || evidenceState === "loading"} type="submit"><Send size={17} /> Send argument</button>
                <button aria-pressed={mic.listening} className="debate-mic" disabled={pending || evidenceState === "loading" || !mic.supported} onClick={() => { if (mic.listening) { resumeMicRef.current = false; mic.stop(); } else { stopInkoSpeech(); mic.start(); } }} type="button">{mic.listening ? <Square fill="currentColor" size={14} /> : <Mic size={16} />} {mic.listening ? "Stop" : "Speak"}</button>
                <button onClick={reset} type="button">All debates</button>
              </div>
            </form>
          </>
        )}
        <div className="activity-footer"><MessageSquareText size={17} /> Debates stay on this device, with the research and chat they came from.</div>
      </div>
    </div>
  );
}
