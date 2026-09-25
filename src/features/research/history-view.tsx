"use client";

import { ArrowRight, Clock, Flame, Layers3, Target } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { useProgress } from "@/features/progress/use-progress";
import { useResearch } from "./use-research";

function relativeTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function HistoryView() {
  const { sessions, loading } = useResearch();
  const { summary } = useProgress();

  return (
    <div className="content-page page-enter">
      <PageHeading eyebrow="History" title="History" description="Look back at your research projects and study momentum." />

      <div className="history-stats">
        <div className="history-stat"><span className="history-stat-icon" data-tone="coral"><Flame size={16} /></span><strong>{summary.streak}</strong><small>Day streak</small></div>
        <div className="history-stat"><span className="history-stat-icon" data-tone="purple"><Layers3 size={16} /></span><strong>{summary.today.cardsReviewed}</strong><small>Cards today</small></div>
        <div className="history-stat"><span className="history-stat-icon" data-tone="blue"><Clock size={16} /></span><strong>{summary.today.focusMinutes}m</strong><small>Focused today</small></div>
        <div className="history-stat"><span className="history-stat-icon" data-tone="teal"><Target size={16} /></span><strong>{summary.quizAccuracy === null ? "—" : `${summary.quizAccuracy}%`}</strong><small>Quiz accuracy</small></div>
      </div>

      <section className="history-section">
        <h2>Research projects</h2>
        {loading ? (
          <div className="library-loading" aria-busy="true"><span /><span /><span /><p>Loading history…</p></div>
        ) : sessions.length === 0 ? (
          <EmptyState icon={Clock} title="Nothing here yet" message="Your research projects will show up here as you create them." action={<Link className="primary-button" href="/research">Start research</Link>} />
        ) : (
          <ul className="history-list">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link className="history-item" href={`/research?session=${session.id}`}>
                  <span className="history-item-dot" aria-hidden="true" />
                  <span className="history-item-body"><strong>{session.question}</strong><small>Updated {relativeTime(session.updated_at)}</small></span>
                  <ArrowRight size={15} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
