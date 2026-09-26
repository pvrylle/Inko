"use client";

import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  FolderOpen,
  Mic2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ContentTopbar } from "@/components/layout/content-topbar";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import { ResearchSessionForm } from "./research-session-form";
import { ResearchTabs } from "./research-tabs";
import { useResearch } from "./use-research";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ResearchView() {
  const research = useResearch();
  const { state } = useMascot();
  const controller = useOptionalVoiceAgent();
  const { sessions, activeSession, loading, error, setActive } = research;
  const appliedParam = useRef(false);

  // Open a specific session when navigated from Home ("/research?session=<id>").
  useEffect(() => {
    if (appliedParam.current) return;
    const id = new URLSearchParams(window.location.search).get("session");
    if (id) {
      appliedParam.current = true;
      setActive(id);
    }
  }, [setActive]);

  const onAsk = (text: string) => {
    if (!controller) return;
    if (controller.connection === "connected") void controller.sendText(text);
    else void controller.start();
  };

  const shortTitle = (question: string) => (question.length > 52 ? `${question.slice(0, 52).trim()}…` : question);

  const derivedActivity = activeSession
    ? [
        { key: "created", tone: "teal", text: "You started this research project", time: relativeTime(activeSession.created_at) },
        research.sources.length ? { key: "sources", tone: "blue", text: `Inko found ${research.sources.length} relevant source${research.sources.length === 1 ? "" : "s"}.`, time: relativeTime(activeSession.updated_at) } : null,
        research.contradictions.length ? { key: "contradictions", tone: "coral", text: `Inko identified ${research.contradictions.length} contradiction${research.contradictions.length === 1 ? "" : "s"}.`, time: relativeTime(activeSession.updated_at) } : null,
        research.findings.length ? { key: "findings", tone: "blue", text: `Inko saved ${research.findings.length} key finding${research.findings.length === 1 ? "" : "s"}.`, time: relativeTime(activeSession.updated_at) } : null,
        research.openQuestions.length ? { key: "questions", tone: "amber", text: `${research.openQuestions.length} open question${research.openQuestions.length === 1 ? "" : "s"} to explore.`, time: relativeTime(activeSession.updated_at) } : null,
      ].filter(Boolean)
    : [];
  const activity = research.activity.length ? research.activity : derivedActivity;

  if (loading && !activeSession) {
    return (
      <div className="research-view-page page-enter">
        <ContentTopbar className="research-topbar"><Link className="back-home" href="/"><ArrowLeft size={15} /> Back to Home</Link></ContentTopbar>
        <div className="research-loading" aria-live="polite" aria-busy="true">
          <span className="research-loading-orb" />
          <p>Organising your research desk…</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="research-view-page page-enter">
        <ContentTopbar className="research-topbar"><Link className="back-home" href="/"><ArrowLeft size={15} /> Back to Home</Link></ContentTopbar>
        {error && <p className="form-error research-error" role="alert">{error}</p>}

        <div className="research-start">
          <div className="research-start-card">
            <span className="research-start-mascot" aria-hidden="true"><InkoMascot state={state} className="research-start-inko" fit="contain" /></span>
            <h1>Start a research project</h1>
            <p>Ask a question worth investigating. Inko gathers sources, weighs findings, and surfaces contradictions with you.</p>
            <ResearchSessionForm createSession={research.createSession} sessionError={research.sessionError} />
          </div>

          {sessions.length > 0 && (
            <div className="research-start-recent">
              <h2>Your research</h2>
              <ul>
                {sessions.map((session) => (
                  <li key={session.id}>
                    <button className="research-start-session" onClick={() => setActive(session.id)} type="button">
                      <span className="research-start-folder"><FolderOpen size={16} /></span>
                      <span><strong>{session.question}</strong><small>Updated {relativeTime(session.updated_at)}</small></span>
                      <ArrowRight size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="research-view-page page-enter">
      <ContentTopbar className="research-topbar"><Link className="back-home" href="/"><ArrowLeft size={15} /> Back to Home</Link></ContentTopbar>

      {error && <p className="form-error research-error" role="alert">{error}</p>}

      <div className="research-workspace">
        <div className="research-main-col">
          <header className="project-header">
            <span className="project-folder" aria-hidden="true"><FolderOpen size={24} /></span>
            <div className="project-heading">
              <h1>{activeSession.title ?? shortTitle(activeSession.question)}</h1>
              <p>{activeSession.description ?? "Inko is helping you gather evidence, weigh findings, and track open questions for this research."}</p>
              <div className="project-meta">
                <span className="meta-chip"><Mic2 size={12} /> Research Project</span>
                <span className="meta-chip"><Calendar size={12} /> Last updated {relativeTime(activeSession.updated_at)}</span>
                <span className="meta-chip meta-chip-active"><i /> Active</span>
              </div>
            </div>
            <div className="project-mascot">
              <span className="project-mascot-bubble">I&apos;ve gathered some sources for your research!</span>
              <InkoMascot state={state} className="project-mascot-inko" fit="contain" />
            </div>
          </header>

          <ResearchTabs
            activeSession={activeSession}
            sources={research.sources}
            findings={research.findings}
            contradictions={research.contradictions}
            openQuestions={research.openQuestions}
            canvasContent={research.canvasContent}
            saveCanvas={research.saveCanvas}
            activeTab={research.activeTab}
            setActiveTab={research.setActiveTab}
            onAsk={onAsk}
          />
        </div>

        <aside className="research-rail" aria-label="Research overview">
          <article className="rail-card">
            <div className="rail-card-head">
              <span className="rail-card-title"><FileText size={15} /> Recent Sources</span>
              <button className="rail-view-all" onClick={() => research.setActiveTab("sources")} type="button">View all <ArrowRight size={12} /></button>
            </div>
            {research.sources.length === 0 ? (
              <p className="rail-empty">Inko will list gathered sources here.</p>
            ) : (
              <ul className="recent-sources-list">
                {research.sources.slice(0, 4).map((source) => (
                  <li className="recent-source" key={source.id}>
                    <span className="recent-source-icon" aria-hidden="true"><FileText size={15} /></span>
                    <span className="recent-source-body">
                      <strong>{source.title}</strong>
                      <small>{source.meta ?? source.type.toUpperCase()}</small>
                    </span>
                    <span className="recent-source-tag" data-tag={source.tag}>{source.tag === "supports" ? "Supports" : "Contradicts"}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rail-card">
            <span className="rail-card-title"><Clock size={15} /> Recent Activity</span>
            {activity.length === 0 ? (
              <p className="rail-empty">Your research activity will appear here.</p>
            ) : (
              <ul className="recent-activity-list">
                {activity.map((item) => item && (
                  <li className="recent-activity" key={item.key}>
                    <span className="recent-activity-dot" data-tone={item.tone} aria-hidden="true" />
                    <span className="recent-activity-body"><span>{item.text}</span><small>{item.time}</small></span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rail-card keep-going-card">
            <span className="keep-going-mascot" aria-hidden="true"><InkoMascot state={state} className="keep-going-inko" fit="cover" /></span>
            <div className="keep-going-body">
              <strong>Keep going!</strong>
              <span>Explore the contradictions or open the full source list.</span>
            </div>
            <button className="keep-going-button" onClick={() => research.setActiveTab("contradictions")} type="button" aria-label="Explore contradictions"><ArrowRight size={16} /></button>
          </article>
        </aside>
      </div>
    </div>
  );
}
