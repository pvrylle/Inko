"use client";

import { Award, BarChart3, Brain, Clock3, Flame, Layers3, Lock, Target } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { useProgress } from "./use-progress";

const activityIcons = { cards: Layers3, quiz: Brain, focus: Clock3 };
const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

function intensityLevel(count: number) {
  if (count === 0) return 0;
  if (count < 3) return 1;
  if (count < 6) return 2;
  if (count < 10) return 3;
  return 4;
}

export function ProgressView() {
  const { summary, loading, error } = useProgress();
  const hasActivity = summary.cardsReviewed > 0 || summary.quizTotal > 0 || summary.completedFocusSessions > 0;
  const today = summary.today;

  return (
    <div className="content-page page-enter">
      <PageHeading eyebrow="Small steps add up" title="Your progress" description="A gentle, owner-private look at the practice and focus you have invested." />

      <div className="stat-strip progress-stats" aria-label="Study progress" aria-busy={loading}>
        <span><strong>{summary.streak}</strong><small>Day streak</small></span>
        <span><strong>{summary.cardsReviewed}</strong><small>Cards reviewed</small></span>
        <span><strong>{summary.quizAccuracy === null ? "—" : `${summary.quizAccuracy}%`}</strong><small>Quiz accuracy</small></span>
        <span><strong>{summary.focusMinutes}</strong><small>Focus minutes</small></span>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="today-panel" aria-label="Today so far">
        <div className="today-panel-header">
          <div><p className="eyebrow">Today so far</p><h2>Your rhythm</h2></div>
          <span className="today-average">Avg session {summary.averageFocusMinutes || 0}m</span>
        </div>
        <div className="today-chips">
          <span className="today-chip"><Flame size={15} /> {summary.streak} day streak</span>
          <span className="today-chip"><Layers3 size={15} /> {today.cardsReviewed} cards</span>
          <span className="today-chip"><Target size={15} /> {today.quizTotal ? `${today.quizCorrect}/${today.quizTotal} quiz` : "0/0 quiz"}</span>
          <span className="today-chip"><Clock3 size={15} /> {today.focusMinutes}m focus</span>
        </div>
      </section>

      {summary.weekly.length > 0 && (
        <section className="heatmap-card" aria-label="7 day activity heatmap">
          <div className="section-title-row">
            <div><p className="eyebrow">Last 7 days</p><h2>Consistency map</h2></div>
            <span className="heatmap-legend" aria-hidden="true">
              <span data-level="0" /><span data-level="1" /><span data-level="2" /><span data-level="3" /><span data-level="4" /><small>more</small>
            </span>
          </div>
          <ol className="heatmap-grid" role="list">
            {summary.weekly.map((day) => {
              const dow = new Date(day.date).getUTCDay();
              const label = `${day.cards} cards, ${day.quiz} quiz answers, ${day.focus} focus minutes on ${day.date}`;
              return (
                <li key={day.date}>
                  <span aria-label={label} className="heatmap-cell" data-level={intensityLevel(day.count)} title={label} />
                  <small>{dayLabels[dow]}</small>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {summary.achievements.length > 0 && (
        <section className="achievements-card" aria-label="Achievements">
          <div className="section-title-row">
            <div><p className="eyebrow">Milestones</p><h2>Achievements</h2></div>
            <span className="achievements-meta">{summary.achievements.filter((achievement) => achievement.achieved).length} unlocked</span>
          </div>
          <div className="achievements-grid">
            {summary.achievements.map((achievement) => {
              const percent = Math.max(0, Math.min(100, Math.round((achievement.progress / achievement.target) * 100)));
              return (
                <article className="achievement" data-achieved={achievement.achieved} key={achievement.id}>
                  <span className="achievement-icon">{achievement.achieved ? <Award size={17} /> : <Lock size={16} />}</span>
                  <div>
                    <strong>{achievement.label}</strong>
                    <small>{achievement.description}</small>
                    <div className="achievement-progress" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
                    <span className="achievement-status">{achievement.progress}/{achievement.target}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!loading && !hasActivity ? (
        <EmptyState icon={BarChart3} title="Your story starts today" message="Review a card, answer a quiz, or finish a focus session and it will appear here." />
      ) : hasActivity ? (
        <section className="activity-card" aria-label="Recent study activity">
          <div className="activity-heading"><div><p className="eyebrow">Recent activity</p><h2>Momentum, not perfection</h2></div><span>{summary.quizCorrect}/{summary.quizTotal || 0} quiz answers correct</span></div>
          <div className="activity-list">
            {summary.recent.map((activity) => {
              const Icon = activityIcons[activity.kind];
              return <article key={activity.id}><span><Icon size={17} /></span><div><strong>{activity.label}</strong><small>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(activity.occurredAt))}</small></div></article>;
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
