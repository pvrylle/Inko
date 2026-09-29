"use client";

import { ArrowRight, BookOpen, FileSearch, FolderOpen, Lightbulb, Plus, Search, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ContentTopbar } from "@/components/layout/content-topbar";
import { useMascot } from "@/features/mascot/mascot-provider";
import { ResearchSessionForm } from "./research-session-form";
import { ResearchTabs } from "./research-tabs";
import { useResearch } from "./use-research";
import { usePublishBrief } from "@/features/page-brief/page-brief";

function relativeTime(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime();
  const hours = Math.max(1, Math.round(elapsed / 3600000));
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

export function ResearchView() {
  const research = useResearch();
  const searchParams = useSearchParams();
  const { dispatch } = useMascot();
  const { sessions, activeSession, loading, error, setActive, startNewProject } = research;
  const appliedParam = useRef("");
  const previousStatus = useRef<string | null>(null);
  const recentInvestigations = sessions.slice(0, 6);
  const visibleInvestigations = activeSession && !recentInvestigations.some((session) => session.id === activeSession.id)
    ? [activeSession, ...recentInvestigations.slice(0, 5)]
    : recentInvestigations;

  useEffect(() => {
    const status = activeSession?.status ?? null;
    if (!status || status === previousStatus.current) return;
    const prior = previousStatus.current;
    previousStatus.current = status;
    if (status === "analyzing") dispatch({ type: "RESEARCH_STARTED" });
    if (prior === "analyzing" && status === "ready") {
      dispatch({ type: "WORK_STARTED", label: "Organising the findings." });
      const done = window.setTimeout(() => dispatch({ type: "REPLY_DONE" }), 700);
      return () => window.clearTimeout(done);
    }
  }, [activeSession?.status, dispatch]);

  const sessionFromUrl = searchParams.get("session");
  const tabFromUrl = searchParams.get("tab");
  const questionFromUrl = searchParams.get("question")?.trim().slice(0, 500) ?? "";

  useEffect(() => {
    const key = `${sessionFromUrl ?? ""}|${tabFromUrl ?? ""}|${questionFromUrl}`;
    if (appliedParam.current === key) return;
    appliedParam.current = key;
    const tab = tabFromUrl === "sources" || tabFromUrl === "findings" || tabFromUrl === "contradictions" || tabFromUrl === "notes" || tabFromUrl === "open-questions" || tabFromUrl === "overview" ? tabFromUrl : undefined;
    if (sessionFromUrl) setActive(sessionFromUrl, tab);
    else if (questionFromUrl) startNewProject();
  }, [questionFromUrl, sessionFromUrl, setActive, startNewProject, tabFromUrl]);

  const researchQuestion = activeSession?.question?.trim().slice(0, 300) ?? null;
  usePublishBrief(researchQuestion ? { kind: "research", label: `Research: ${researchQuestion.slice(0, 80)}`, detail: `Research question: ${researchQuestion}` } : null);

  return (
    <div className="research-view-page page-enter">
      <ContentTopbar className="research-topbar">
        <span className="research-topbar-title"><FileSearch size={17} /> Research</span>
      </ContentTopbar>
      {error && <p className="form-error research-error" role="alert">{error}</p>}

      {!activeSession ? (
        <div className="research-hub">
          <header className="research-hub-heading">
            <span className="research-kicker"><Sparkles size={14} /> RESEARCH WORKSPACE</span>
            <h1>Follow the question. Find the evidence.</h1>
            <p>Build a clear line of inquiry with sources, findings, contradictions, and notes in one place.</p>
          </header>

          <div className="research-hub-grid">
            <section className="research-inquiry-card" aria-labelledby="research-inquiry-title">
              <div className="research-card-heading"><span className="research-card-icon"><Search size={21} /></span><div><span className="research-step">01 / BEGIN</span><h2 id="research-inquiry-title">What are you investigating?</h2></div></div>
              <p>Start with a focused question. Inko will gather and organize the evidence around it.</p>
              <ResearchSessionForm key={questionFromUrl} createSession={research.createSession} initialQuestion={questionFromUrl} sessionError={research.sessionError} />
            </section>

            <aside className="research-process-card" aria-label="Research process">
              <span className="research-step">YOUR RESEARCH PROCESS</span>
              <h2>From question to clarity</h2>
              <ol>
                <li><span><FileSearch size={18} /></span><div><strong>Gather sources</strong><small>Keep useful references together.</small></div></li>
                <li><span><Lightbulb size={18} /></span><div><strong>Compare findings</strong><small>See what the evidence supports.</small></div></li>
                <li><span><BookOpen size={18} /></span><div><strong>Develop your thinking</strong><small>Track tensions, questions, and notes.</small></div></li>
              </ol>
            </aside>
          </div>

          <section className="research-library" aria-labelledby="research-library-title">
            <div className="research-library-heading"><div><span className="research-step">YOUR WORK</span><h2 id="research-library-title">Research library <span>{sessions.length}</span></h2></div></div>
            {loading ? <p className="research-library-empty" aria-live="polite">Loading research…</p> : sessions.length === 0 ? (
              <div className="research-library-empty"><FolderOpen size={25} /><strong>Your investigations will live here.</strong><span>Start a question above to build your first research workspace.</span></div>
            ) : (
              <div className="research-library-list">
                {sessions.map((session) => <button className="research-library-row" key={session.id} onClick={() => setActive(session.id)} type="button"><span className="research-library-icon"><FolderOpen size={18} /></span><span className="research-library-copy"><strong>{session.title || session.question}</strong><small>{session.question}</small></span><span className="research-library-time">{relativeTime(session.updated_at)}</span><ArrowRight size={17} /></button>)}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="research-detail">
          <div className="research-detail-heading">
            <div><span className="research-kicker">RESEARCH / INVESTIGATION</span><h1>{activeSession.title || activeSession.question}</h1>{activeSession.title && activeSession.title !== activeSession.question ? <p>{activeSession.question}</p> : null}</div>
            <button className="research-new-button" onClick={startNewProject} type="button"><Plus size={17} /> New research</button>
          </div>
          <div className="research-detail-layout">
            <aside className="research-investigations" aria-label="Investigations">
              <span className="research-step">RECENT INVESTIGATIONS</span>
              {visibleInvestigations.map((session) => <button aria-current={session.id === activeSession.id ? "true" : undefined} aria-label={`Open ${session.title || session.question}`} key={session.id} onClick={() => setActive(session.id)} title={session.title || session.question} type="button"><FolderOpen size={16} /><span><strong>{session.title || session.question}</strong><small>Updated {relativeTime(session.updated_at)}</small></span></button>)}
              <button className="research-investigations-all" onClick={startNewProject} type="button">View all {sessions.length} investigations <ArrowRight size={15} /></button>
            </aside>
            <ResearchTabs activeSession={activeSession} sources={research.sources} findings={research.findings} contradictions={research.contradictions} openQuestions={research.openQuestions} canvasContent={research.canvasContent} noteMarkdown={research.noteMarkdown} saveCanvas={research.saveCanvas} activeTab={research.activeTab} setActiveTab={research.setActiveTab} />
          </div>
        </div>
      )}
    </div>
  );
}
