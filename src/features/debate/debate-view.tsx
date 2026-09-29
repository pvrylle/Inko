"use client";

import { ArrowRight, MessageSquareText, Send } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentTopbar } from "@/components/layout/content-topbar";
import { useAuth } from "@/components/providers/auth-provider";
import { useOptionalProjects } from "@/features/projects/project-provider";
import { listContradictions, listFindings, listSources } from "@/features/research/research-repository";
import { inkoFetch } from "@/lib/auth/api-client";

export type DebateMode = "debate" | "socratic" | "defense";

type DebateTurn = { role: "student" | "inko"; text: string };
type DebateEvidence = { kind: "source" | "finding" | "contradiction"; text: string; tag?: "supports" | "contradicts" };
type DebateVerdict = { conceded: string; unanswered: string; nextStep: string };

const MODES: { id: DebateMode; title: string; detail: string }[] = [
  { id: "debate", title: "Debate", detail: "You defend. Inko takes the other side." },
  { id: "socratic", title: "Socratic", detail: "Only questions. No answers." },
  { id: "defense", title: "Defense", detail: "The hardest objection from your research." },
];

function isMode(value: string): value is DebateMode {
  return value === "debate" || value === "socratic" || value === "defense";
}

export function DebateView({
  initialTopic = "",
  initialClaim = "",
  initialMode = "debate",
  initialLive = false,
  sessionId = "",
}: {
  initialTopic?: string;
  initialClaim?: string;
  initialMode?: DebateMode;
  initialLive?: boolean;
  sessionId?: string;
}) {
  const router = useRouter();
  const projects = useOptionalProjects();
  const { userId } = useAuth();
  const [mode, setMode] = useState<DebateMode>(isMode(initialMode) ? initialMode : "debate");
  const [position, setPosition] = useState(initialClaim || initialTopic);
  const [started, setStarted] = useState(initialLive);
  const [argument, setArgument] = useState("");
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [evidence, setEvidence] = useState<DebateEvidence[]>([]);
  const [verdict, setVerdict] = useState<DebateVerdict | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStarted(initialLive);
    if (initialLive) return;
    setMode(isMode(initialMode) ? initialMode : "debate");
    setPosition(initialClaim || initialTopic);
    setTurns([]);
    setVerdict(null);
    setError(null);
  }, [initialClaim, initialLive, initialMode, initialTopic]);

  useEffect(() => {
    if (!sessionId || !userId) return;
    let cancelled = false;
    Promise.all([
      listSources(userId, sessionId),
      listFindings(userId, sessionId),
      listContradictions(userId, sessionId),
    ]).then(([sources, findings, contradictions]) => {
      if (cancelled) return;
      const next: DebateEvidence[] = [
        ...sources.map((source) => ({
          kind: "source" as const,
          text: source.title,
          ...(source.tag === "supports" || source.tag === "contradicts" ? { tag: source.tag } : {}),
        })),
        ...findings.map((finding) => ({ kind: "finding" as const, text: finding.statement })),
        ...contradictions.map((item) => ({ kind: "contradiction" as const, text: item.explanation })),
      ];
      setEvidence(next.slice(0, 24));
    }).catch(() => {
      if (!cancelled) setEvidence([]);
    });
    return () => { cancelled = true; };
  }, [sessionId, userId]);

  const begin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const claim = position.trim().slice(0, 500);
    if (!claim) return;
    const topic = claim.slice(0, 200);
    const params = new URLSearchParams({ topic, mode, claim, live: "1" });
    if (sessionId) params.set("session", sessionId);
    const href = `/debate?${params.toString()}`;
    router.replace(href);
    projects?.addActivity("debate", topic, href);
    setPosition(claim);
    setStarted(true);
    setTurns([]);
    setVerdict(null);
    setError(null);
  };

  const submitArgument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = argument.trim();
    if (!text || pending) return;
    setArgument("");
    setError(null);
    setPending(true);
    const history = turns.slice(-12);
    setTurns((current) => [...current, { role: "student", text }]);
    try {
      const response = await inkoFetch("/api/debate", {
        method: "POST",
        body: JSON.stringify({
          mode,
          topic: position.slice(0, 200),
          argument: text,
          history,
          evidence,
        }),
        signal: AbortSignal.timeout(22_000),
      });
      const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string; verdict?: DebateVerdict | null };
      if (!response.ok || !payload.text) {
        setTurns((current) => current.slice(0, -1));
        const message = payload.error === "GUEST_LIMIT"
          ? "Guest limit reached. Create a free account to keep going."
          : "Inko couldn't answer that turn. Try again.";
        setError(message);
        return;
      }
      setTurns((current) => [...current, { role: "inko", text: payload.text ?? "" }]);
      if (payload.verdict?.conceded && payload.verdict.unanswered && payload.verdict.nextStep) setVerdict(payload.verdict);
    } catch {
      setTurns((current) => current.slice(0, -1));
      setError("Inko couldn't answer that turn. Try again.");
    } finally {
      setPending(false);
    }
  };

  const reset = () => {
    setStarted(false);
    setTurns([]);
    setVerdict(null);
    setError(null);
    router.replace("/debate");
  };

  return (
    <div className="activity-workspace page-enter">
      <ContentTopbar />
      <div className="activity-content">
        <header className="activity-heading">
          <span className="workspace-eyebrow">Debate</span>
          <h1>{started ? position : "Argue it out"}</h1>
          <p>{started ? MODES.find((item) => item.id === mode)?.detail : "Pick a mode, then state the position you want to defend."}</p>
        </header>
        {!started ? (
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
            <div><button type="submit">Start <ArrowRight size={17} /></button></div>
          </form>
        ) : (
          <>
            <p className="debate-evidence-note">
              {sessionId
                ? evidence.length
                  ? `Using ${evidence.length} item${evidence.length === 1 ? "" : "s"} from this research session.`
                  : "No research evidence is attached yet. Defense mode will say so instead of inventing a source."
                : "This debate is not tied to a research session."}
            </p>
            <div className="debate-thread" aria-live="polite">
              {turns.length === 0 ? <p className="debate-evidence-note">Make your opening argument below.</p> : turns.map((turn, index) => (
                <article className="debate-turn" key={`${turn.role}-${index}`}>
                  <h2>{turn.role === "student" ? "You" : "Inko"}</h2>
                  <p>{turn.text}</p>
                </article>
              ))}
              {pending ? <p className="debate-evidence-note">Thinking through your point...</p> : null}
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
            <form className="debate-argument-form" onSubmit={(event) => void submitArgument(event)}>
              <label htmlFor="debate-argument">Your argument</label>
              <textarea id="debate-argument" maxLength={4000} onChange={(event) => setArgument(event.target.value)} placeholder="I think..." rows={4} value={argument} />
              <div>
                <button className="workspace-command" disabled={!argument.trim() || pending} type="submit"><Send size={17} /> Send argument</button>
                <button onClick={reset} type="button">Change topic</button>
              </div>
            </form>
          </>
        )}
        <div className="activity-footer"><MessageSquareText size={17} /> Turns stay on this page.</div>
      </div>
    </div>
  );
}
