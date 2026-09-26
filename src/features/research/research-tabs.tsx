"use client";

import { FileText, GitCompare, HelpCircle, Info, Lightbulb, Mic2, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  onAsk?: (text: string) => void;
};

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { id: ResearchTab; label: string }[] = [
  { id: "overview",       label: "Overview" },
  { id: "sources",        label: "Sources" },
  { id: "findings",       label: "Findings" },
  { id: "contradictions", label: "Contradictions" },
  { id: "canvas",         label: "Canvas" },
  { id: "notes",          label: "Notes" },
  { id: "open-questions", label: "Open Questions" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const overviewAskChips = [
  "Show me the sources.",
  "Find contradictory studies.",
  "Put the main arguments on the canvas.",
];

const findingIcons = [
  { Icon: Lightbulb, tone: "teal" },
  { Icon: Info, tone: "blue" },
  { Icon: Info, tone: "purple" },
] as const;

/** Overview tab — Inko-guided summary of the active session (Requirement 8.4). */
function OverviewPanel({
  session,
  sources,
  findings,
  contradictions,
  openQuestions,
  setActiveTab,
  onAsk,
}: {
  session: ResearchSession;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  contradictions: ResearchContradiction[];
  openQuestions: OpenQuestion[];
  setActiveTab: (tab: ResearchTab) => void;
  onAsk?: (text: string) => void;
}) {
  const stats = [
    { key: "sources" as const, label: "Sources", value: sources.length, Icon: FileText, tone: "blue" },
    { key: "findings" as const, label: "Key Findings", value: findings.length, Icon: Lightbulb, tone: "teal" },
    { key: "contradictions" as const, label: "Contradiction" + (contradictions.length === 1 ? "" : "s"), value: contradictions.length, Icon: GitCompare, tone: "purple" },
    { key: "open-questions" as const, label: "Open Question" + (openQuestions.length === 1 ? "" : "s"), value: openQuestions.length, Icon: HelpCircle, tone: "coral" },
  ];

  return (
    <div className="research-panel research-overview">
      <div className="overview-section-head"><FileText size={16} /> <h3>Overview</h3></div>

      <div className="overview-ask">
        <span className="overview-ask-icon" aria-hidden="true"><Mic2 size={16} /></span>
        <p>You can ask me anything about this research project.</p>
        <div className="overview-ask-chips">
          {overviewAskChips.map((chip) => (
            <button key={chip} onClick={() => onAsk?.(chip)} type="button">&ldquo;{chip}&rdquo;</button>
          ))}
        </div>
      </div>

      <div className="overview-stats">
        {stats.map(({ key, label, value, Icon, tone }) => (
          <button className="overview-stat" data-tone={tone} key={key} onClick={() => setActiveTab(key)} type="button">
            <span className="overview-stat-icon"><Icon size={18} /></span>
            <strong>{value}</strong>
            <small>{label}</small>
          </button>
        ))}
      </div>

      <section className="overview-question">
        <div className="overview-section-head"><Target size={16} /> <h3>Research Question</h3></div>
        <div className="overview-question-box">{session.question}</div>
      </section>

      <section className="overview-findings">
        <div className="overview-section-head overview-section-head--row">
          <span><Lightbulb size={16} /> <h3>Key Findings</h3></span>
          {findings.length > 0 && (
            <button className="overview-view-all" onClick={() => setActiveTab("findings")} type="button">View all →</button>
          )}
        </div>
        {findings.length === 0 ? (
          <p className="overview-empty">Inko will list key findings here as your sources are analysed.</p>
        ) : (
          <ul className="overview-finding-list">
            {findings.slice(0, 3).map((finding, index) => {
              const { Icon, tone } = findingIcons[index % findingIcons.length];
              const count = finding.sourceCount ?? (sources.filter((source) => source.id === finding.source_id).length || 1);
              return (
                <li className="overview-finding" key={finding.id}>
                  <span className="overview-finding-icon" data-tone={tone}><Icon size={15} /></span>
                  <p>{finding.statement}</p>
                  <span className="overview-finding-tag">{count} source{count === 1 ? "" : "s"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
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
}: {
  finding: ResearchFinding;
  sources: ResearchSource[];
}) {
  const attributedSource = sources.find((s) => s.id === finding.source_id);

  return (
    <article className="finding-entry">
      <p className="finding-statement">{finding.statement}</p>
      {attributedSource && (
        <footer className="finding-attribution">
          <span className="finding-source-label">Source:</span>{" "}
          <span className="finding-source-title">{attributedSource.title}</span>
        </footer>
      )}
    </article>
  );
}

/** Findings tab panel (Requirement 8.6). */
function FindingsPanel({
  findings,
  sources,
}: {
  findings: ResearchFinding[];
  sources: ResearchSource[];
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
            <FindingEntry finding={finding} sources={sources} />
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

/** Canvas tab — free-form textarea auto-saved on change (debounced 400 ms) and on blur (Requirement 8.13). */
function CanvasPanel({
  canvasContent,
  saveCanvas,
  sessionId,
}: {
  canvasContent: string;
  saveCanvas: (content: string) => Promise<void>;
  sessionId: string;
}) {
  const [value, setValue] = useState(canvasContent);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    // Canvas drafts intentionally synchronize when persisted content or the
    // active research session changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(canvasContent);
  }, [canvasContent, sessionId]);

  const persist = (text: string) => {
    if (savingRef.current) return;
    savingRef.current = true;
    saveCanvas(text).finally(() => {
      savingRef.current = false;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setValue(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(text), 400);
  };

  const handleBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    persist(value);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="research-panel research-canvas-panel">
      <label className="sr-only" htmlFor="research-canvas">
        Canvas notes
      </label>
      <textarea
        className="research-canvas-textarea"
        id="research-canvas"
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Write anything here — scratch notes, raw ideas, working hypotheses…"
        value={value}
      />
    </div>
  );
}

/** Notes tab — structured markdown display (Requirement 8.14). */
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
 * Renders 7 tabs in order: Overview, Sources, Findings, Contradictions,
 * Canvas, Notes, Open Questions. Uses WAI-ARIA `tablist` / `tab` /
 * `tabpanel` pattern throughout (Requirements 8.4–8.8, 8.13, 8.14).
 */
export function ResearchTabs({
  activeSession,
  sources,
  findings,
  contradictions,
  openQuestions,
  canvasContent,
  noteMarkdown,
  saveCanvas,
  activeTab,
  setActiveTab,
  onAsk,
}: Props) {
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
            aria-selected={activeTab === id}
            aria-controls={panelId(id)}
            className="research-tab"
            data-active={activeTab === id ? "true" : undefined}
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
          hidden={activeTab !== id}
          tabIndex={0}
          className="research-tabpanel"
        >
          {/* Render only the active panel to avoid wasted work */}
          {activeTab === id && renderPanel(id, {
            activeSession,
            sources,
            findings,
            contradictions,
            openQuestions,
            canvasContent,
            noteMarkdown,
            saveCanvas,
            setActiveTab,
            onAsk,
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
    canvasContent,
    noteMarkdown,
    saveCanvas,
    setActiveTab,
    onAsk,
  }: Omit<Props, "activeTab">,
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
          onAsk={onAsk}
        />
      );
    case "sources":
      return <SourcesPanel sources={sources} />;
    case "findings":
      return <FindingsPanel findings={findings} sources={sources} />;
    case "contradictions":
      return (
        <ContradictionsPanel
          contradictions={contradictions}
          sources={sources}
        />
      );
    case "canvas":
      return (
        <CanvasPanel
          canvasContent={canvasContent}
          saveCanvas={saveCanvas}
          sessionId={activeSession.id}
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
