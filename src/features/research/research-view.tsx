"use client";

import { ArrowRight, FolderOpen } from "lucide-react";
import { useEffect, useRef } from "react";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
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
  const { state, dispatch } = useMascot();
  const { sessions, activeSession, loading, error, setActive, startNewProject } = research;
  const previousStatus = useRef<string | null>(null);

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
  const appliedParam = useRef(false);

  // Open a specific session when navigated from Home ("/research?session=<id>").
  useEffect(() => {
    if (appliedParam.current) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("session");
    const tab = params.get("tab");
    if (id) {
      appliedParam.current = true;
      setActive(id, tab === "sources" || tab === "findings" || tab === "contradictions" || tab === "canvas" || tab === "notes" || tab === "open-questions" || tab === "overview" ? tab : undefined);
    }
  }, [setActive]);

  const shortTitle = (question: string) => (question.length > 52 ? `${question.slice(0, 52).trim()}…` : question);

  if (loading && !activeSession) {
    return (
      <div className="research-view-page page-enter">
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
        {error && <p className="form-error research-error" role="alert">{error}</p>}

        <div className="research-start">
          <div className="research-start-card">
            <h1>What topic are you researching?</h1>
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
      {error && <p className="form-error research-error" role="alert">{error}</p>}

      <div className="research-conversation">
        <header className="research-conversation-header">
          <div><span>Research</span><h1>{activeSession.title ?? shortTitle(activeSession.question)}</h1></div>
          <button className="secondary-button" onClick={startNewProject} type="button">New research</button>
        </header>

        <div className="research-conversation-thread">
          <div className="research-message research-message-user">
            <span>You</span>
            <p>{activeSession.question}</p>
          </div>

          <section className="research-message research-message-inko" aria-label="Inko research response">
            <InkoMascot state={state} className="research-message-avatar" fit="cover" />
            <div className="research-message-body">
              <div className="research-message-heading"><strong>Inko</strong><span>Updated {relativeTime(activeSession.updated_at)}</span></div>
              <p>{activeSession.description?.trim() || "I’m gathering sources and organizing what they tell us. Explore the evidence below."}</p>
              <ResearchTabs
                activeSession={activeSession}
                sources={research.sources}
                findings={research.findings}
                contradictions={research.contradictions}
                openQuestions={research.openQuestions}
                canvasContent={research.canvasContent}
                noteMarkdown={research.noteMarkdown}
                saveCanvas={research.saveCanvas}
                activeTab={research.activeTab}
                setActiveTab={research.setActiveTab}
              />
              {research.activity.length > 0 && (
                <details className="research-activity">
                  <summary>Research activity ({research.activity.length})</summary>
                  <ul>
                    {research.activity.map((item) => <li key={item.key}><span>{item.text}</span><small>{item.time}</small></li>)}
                  </ul>
                </details>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
