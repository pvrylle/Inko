"use client";

import { ArrowUpRight, Flame, Layers3, Target, Timer } from "lucide-react";
import Link from "next/link";
import { useProgress } from "@/features/progress/use-progress";
import { useDailyGoal } from "@/features/focus/use-daily-goal";

function pct(value: number, target: number) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

export function TodaySnapshot() {
  const { summary } = useProgress();
  const { goalMinutes } = useDailyGoal();
  const today = summary.today;
  const focusProgress = pct(today.focusMinutes, goalMinutes);
  const accuracyToday = today.quizTotal ? Math.round((today.quizCorrect / today.quizTotal) * 100) : null;

  const cards: Array<{
    id: string;
    icon: React.ReactNode;
    label: string;
    value: string;
    caption: string;
    href: string;
    accent: "violet" | "coral" | "aqua" | "amber";
    progress?: number;
  }> = [
    { id: "streak", icon: <Flame size={18} />, label: "Streak", value: `${summary.streak}d`, caption: summary.streak >= 3 ? "Keep the fire lit" : "Start a new streak", href: "/progress", accent: "amber" },
    { id: "cards", icon: <Layers3 size={18} />, label: "Cards today", value: String(today.cardsReviewed), caption: today.cardsReviewed ? "Nice recall" : "Warm up with a card", href: "/flashcards", accent: "violet" },
    { id: "focus", icon: <Timer size={18} />, label: "Focus today", value: `${today.focusMinutes}m`, caption: `${focusProgress}% of ${goalMinutes}m goal`, href: "/focus", accent: "aqua", progress: focusProgress },
    { id: "quiz", icon: <Target size={18} />, label: "Quiz accuracy", value: accuracyToday === null ? "—" : `${accuracyToday}%`, caption: today.quizTotal ? `${today.quizCorrect}/${today.quizTotal} today` : "Try a quick round", href: "/quiz", accent: "coral" },
  ];

  return (
    <section className="today-snapshot" aria-label="Today's snapshot">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Today so far</p>
          <h2>Your snapshot</h2>
        </div>
        <Link className="section-link" href="/progress">Full progress <ArrowUpRight size={14} /></Link>
      </div>
      <div className="snapshot-grid">
        {cards.map((card) => (
          <Link className="snapshot-card" data-accent={card.accent} href={card.href} key={card.id}>
            <span className="snapshot-icon" aria-hidden="true">{card.icon}</span>
            <div>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              <small>{card.caption}</small>
              {typeof card.progress === "number" && (
                <div className="snapshot-progress" aria-hidden="true"><span style={{ width: `${card.progress}%` }} /></div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
