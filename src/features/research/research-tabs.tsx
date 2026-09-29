"use client";

import { FileText, GitCompare, HelpCircle, Lightbulb } from "lucide-react";
import Link from "next/link";
import type {
  OpenQuestion,
  ResearchContradiction,
  ResearchFinding,
  ResearchSession,
  ResearchSource,
} from "./research-schema";
import type { ResearchTab } from "./use-research";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  activeSession: ResearchSession;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  contradictions: ResearchContradiction[];
  openQuestions: OpenQuestion[];
  canvasContent: string;
  noteMarkdown?: string;
  saveCanvas: (content: string) => Promise<void>;
  activeTab: ResearchTab;
  setActiveTab: (tab: ResearchTab) => void;
};

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { id: Exclude<ResearchTab, "canvas">; label: string }[] = [
  { id: "overview",       label: "Overview" },
  { id: "sources",        label: "Sources" },
  { id: "findings",       label: "Findings" },
  { id: "gaps",           label: "Gaps" },
  { id: "contradictions", label: "Contradictions" },
  { id: "notes",          label: "Notes" },
  { id: "open-questions", label: "Open Questions" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function debateHref(sessionId: string, claim: string, mode: "debate" | "defense" | "socratic") {
  const params = new URLSearchParams({
    session: sessionId,
    claim: claim.slice(0, 500),
    topic: claim.slice(0, 200),
    mode,
  });
  return `/debate?${params.toString()}`;
}

/** Overview tab — the question and shortcuts into the other tabs. */
function OverviewPanel({
  session,
  sources,
  findings,
  contradictions,
  openQuestions,
  setActiveTab,
}: {
  session: ResearchSession;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  contradictions: ResearchContradiction[];
  openQuestions: OpenQuestion[];
  setActiveTab: (tab: ResearchTab) => void;
}) {
  const gapCount = contradictions.length + openQuestions.length;
  const firstFinding = findings[0]?.statement;
  const firstGap = contradictions[0]?.explanation ?? openQuestions[0]?.text;
  const stats = [
    { key: "sources" as const, label: "Sources", value: sources.length, Icon: FileText, tone: "blue" },
    { key: "findings" as const, label: "Findings", value: findings.length, Icon: Lightbulb, tone: "teal" },
    { key: "gaps" as const, label: "Gaps", value: gapCount, Icon: GitCompare, tone: "purple" },
    { key: "open-questions" as const, label: "Open Question" + (openQuestions.length === 1 ? "" : "s"), value: openQuestions.length, Icon: HelpCircle, tone: "coral" },
  ];

  return (
    <div className="research-panel research-overview">
      <section className="overview-question" aria-labelledby="overview-question-title">
        <div className="overview-section-head"><FileText size={16} /> <h3 id="overview-question-title">Question</h3></div>
        <div className="overview-question-box">
          <p>{session.question}</p>
          {session.description ? <p>{session.description}</p> : null}
        </div>
      </section>

      <div className="overview-stats">
        {stats.map(({ key, label, value, Icon, tone }) => (
          <button className="overview-stat" data-tone={tone} key={key} onClick={() => setActiveTab(key)} type="button">
            <span className="overview-stat-icon"><Icon size={18} /></span>
            <strong>{value}</strong>
            <small>{label}</small>
          </button>
        ))}
      </div>

      <div className="overview-jumps">
        <button className="overview-jump" onClick={() => setActiveTab("findings")} type="button">
          <span><Lightbulb size={16} /> Findings</span>
          <strong>{firstFinding ?? "Findings will show up here."}</strong>
          <small>{findings.length > 0 ? "Open" : "Empty"}</small>
        </button>
        <button className="overview-jump" onClick={() => setActiveTab("gaps")} type="button">
          <span><GitCompare size={16} /> Gaps</span>
          <strong>{firstGap ?? "Gaps will show up here."}</strong>
          <small>{gapCount > 0 ? "Open" : "Empty"}</small>
        </button>
      </div>
    </div>
  );
}

/** A single Source card (Requirement 8.5). */
function SourceCard({ source }: { source: ResearchSource }) {
  return (
    <article className="source-card">
      <div className="source-card-header">
        <span className="source-type-badge" data-type={source.type}>
          {source.type}
        </span>
        <span
          className="source-tag-badge"
          data-tag={source.tag}
          aria-label={source.tag === "supports" ? "Supports" : source.tag === "contradicts" ? "Contradicts" : "Untagged"}
        >
          {source.tag === "supports" ? "Supports" : source.tag === "contradicts" ? "Contradicts" : "Untagged"}
        </span>
      </div>
      <h3 className="source-card-title">{source.title}</h3>
      {source.url && (
        <a
          className="source-card-url"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {source.url}
        </a>
      )}
    </article>
  );
}

/** Sources tab panel (Requirement 8.5). */
function SourcesPanel({ sources }: { sources: ResearchSource[] }) {
  if (sources.length === 0) {
    return (
      <div className="research-panel research-empty-panel">
        <p className="research-empty-text">No sources have been added yet.</p>
      </div>
    );
  }

  return (
    <div className="research-panel">
      <ul className="source-card-list" role="list">
        {sources.map((source) => (
          <li key={source.id}>
            <SourceCard source={source} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A single Finding entry (Requirement 8.6). */
function FindingEntry({
  finding,
  sources,
  sessionId,
}: {
  finding: ResearchFinding;
  sources: ResearchSource[];
  sessionId: string;
}) {
  const attributedSource = sources.find((s) => s.id === finding.source_id);

  return (
    <article className="finding-entry">
      <p className="finding-statement">{finding.statement}</p>
      <div className="overview-claim-actions">
        {attributedSource ? (
          <span className="finding-attribution">
            <span className="finding-source-label">Source:</span>{" "}
            <span className="finding-source-title">{attributedSource.title}</span>
          </span>
        ) : null}
        <Link className="overview-debate-link" href={debateHref(sessionId, finding.statement, "debate")}>Debate this</Link>
      </div>
    </article>
  );
}

/** Findings tab panel (Requirement 8.6). */
function FindingsPanel({
  findings,
  sources,
  sessionId,
}: {
  findings: ResearchFinding[];
  sources: ResearchSource[];
  sessionId: string;
}) {
  if (findings.length === 0) {
    return (
      <div className="research-panel research-empty-panel">
        <p className="research-empty-text">No findings recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="research-panel">
      <ul className="finding-list" role="list">
        {findings.map((finding) => (
          <li key={finding.id}>
            <FindingEntry finding={finding} sources={sources} sessionId={sessionId} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function GapsPanel({
  sessionId,
  contradictions,
  openQuestions,
}: {
  sessionId: string;
  contradictions: ResearchContradiction[];
  openQuestions: OpenQuestion[];
}) {
  const gaps = [
    ...contradictions.map((item) => ({ id: item.id, text: item.explanation, mode: "defense" as const })),
    ...openQuestions.map((item) => ({ id: item.id, text: item.text, mode: "socratic" as const })),
  ];
  if (gaps.length === 0) {
    return (
      <div className="research-panel research-empty-panel">
        <p className="research-empty-text">Contradictions and open questions will show up here.</p>
      </div>
    );
  }
  return (
    <div className="research-panel">
      <ul className="overview-claim-list" role="list">
        {gaps.map((gap) => (
          <li className="overview-claim" key={gap.id}>
            <p>{gap.text}</p>
            <div className="overview-claim-actions">
              <Link className="overview-debate-link" href={debateHref(sessionId, gap.text, gap.mode)}>Debate this</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A single Contradiction group (Requirement 8.7). */
function ContradictionGroup({
  contradiction,
  sources,
}: {
  contradiction: ResearchContradiction;
  sources: ResearchSource[];
}) {
  const involvedSources = sources.filter((s) =>
    contradiction.source_ids.includes(s.id),
  );

  return (
    <article className="contradiction-group">
      <div className="contradiction-sources">
        {involvedSources.map((source) => (
          <div key={source.id} className="contradiction-source-chip">
            <span className="source-type-badge" data-type={source.type}>
              {source.type}
            </span>
            <span className="contradiction-chip-title">{source.title}</span>
          </div>
        ))}
      </div>
      <p className="contradiction-explanation">{contradiction.explanation}</p>
    </article>
  );
}

/** Contradictions tab panel (Requirement 8.7). */
function ContradictionsPanel({
  contradictions,
  sources,
}: {
  contradictions: ResearchContradiction[];
  sources: ResearchSource[];
}) {
  if (contradictions.length === 0) {
    return (
      <div className="research-panel research-empty-panel">
        <p className="research-empty-text">No contradictions identified yet.</p>
      </div>
    );
  }

  return (
    <div className="research-panel">
      <ul className="contradiction-list" role="list">
        {contradictions.map((c) => (
          <li key={c.id}>
            <ContradictionGroup contradiction={c} sources={sources} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Notes tab — structured markdown the brief writes for this session. */
function NotesPanel({ session, noteMarkdown }: { session: ResearchSession; noteMarkdown?: string }) {
  return (
    <div className="research-panel research-notes-panel">
      <p className="research-notes-hint">
        {noteMarkdown ? "Notes Inko wrote from the sources in this session." : "Structured notes for this session will appear here once generated."}
      </p>
      <pre className="research-notes-pre" aria-label="Session notes">
        {noteMarkdown || `Session: ${session.question}`}
      </pre>
    </div>
  );
}

/** Open Questions tab (Requirement 8.8). */
function OpenQuestionsPanel({ openQuestions }: { openQuestions: OpenQuestion[] }) {
  if (openQuestions.length === 0) {
    return (
      <div className="research-panel research-empty-panel">
        <p className="research-empty-text">No open questions yet.</p>
      </div>
    );
  }

  return (
    <div className="research-panel">
      <ul className="open-question-list" role="list">
        {openQuestions.map((q) => (
          <li key={q.id} className="open-question-item">
            <span className="open-question-bullet" aria-hidden="true">?</span>
            <p className="open-question-text">{q.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Tabbed interface for a Research Session.
 *
 * Tabs match what a research brief produces: overview, sources, findings,
 * contradictions, notes, and open questions.
 */
export function ResearchTabs({
  activeSession,
  sources,
  findings,
  contradictions,
  openQuestions,
  noteMarkdown,
  activeTab,
  setActiveTab,
}: Props) {
  const shownTab = activeTab === "canvas" ? "overview" : activeTab;
  const panelId = (id: ResearchTab) => `research-panel-${id}`;
  const tabId   = (id: ResearchTab) => `research-tab-${id}`;

  return (
    <div className="research-tabs-root">
      {/* ── Tab bar (Requirement 8.4) ─────────────────────────────────────── */}
      <div
        className="research-tablist"
        role="tablist"
        aria-label="Research session tabs"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            id={tabId(id)}
            role="tab"
            aria-selected={shownTab === id}
            aria-controls={panelId(id)}
            className="research-tab"
            data-active={shownTab === id ? "true" : undefined}
            onClick={() => setActiveTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────────── */}
      {TABS.map(({ id }) => (
        <div
          key={id}
          id={panelId(id)}
          role="tabpanel"
          aria-labelledby={tabId(id)}
          hidden={shownTab !== id}
          tabIndex={0}
          className="research-tabpanel"
        >
          {shownTab === id && renderPanel(id, {
            activeSession,
            sources,
            findings,
            contradictions,
            openQuestions,
            noteMarkdown,
            setActiveTab,
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Panel renderer ───────────────────────────────────────────────────────────

function renderPanel(
  tab: ResearchTab,
  {
    activeSession,
    sources,
    findings,
    contradictions,
    openQuestions,
    noteMarkdown,
    setActiveTab,
  }: Omit<Props, "activeTab" | "canvasContent" | "saveCanvas">,
) {
  switch (tab) {
    case "overview":
      return (
        <OverviewPanel
          session={activeSession}
          sources={sources}
          findings={findings}
          contradictions={contradictions}
          openQuestions={openQuestions}
          setActiveTab={setActiveTab}
        />
      );
    case "sources":
      return <SourcesPanel sources={sources} />;
    case "findings":
      return <FindingsPanel findings={findings} sources={sources} sessionId={activeSession.id} />;
    case "gaps":
      return <GapsPanel sessionId={activeSession.id} contradictions={contradictions} openQuestions={openQuestions} />;
    case "contradictions":
      return (
        <ContradictionsPanel
          contradictions={contradictions}
          sources={sources}
        />
      );
    case "notes":
      return <NotesPanel session={activeSession} noteMarkdown={noteMarkdown} />;
    case "open-questions":
      return <OpenQuestionsPanel openQuestions={openQuestions} />;
    default:
      return null;
  }
}
