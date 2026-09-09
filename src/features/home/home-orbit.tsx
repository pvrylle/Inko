"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Brain,
  Clock3,
  Compass,
  Flame,
  Layers3,
  MicVocal,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFlashcards } from "@/features/flashcards/use-flashcards";
import { useFocusSession } from "@/features/focus/use-focus-session";
import { useMascot } from "@/features/mascot/mascot-provider";
import { MascotStage } from "@/features/mascot/mascot-stage";
import { useNotes } from "@/features/notes/use-notes";
import { useProgress } from "@/features/progress/use-progress";
import { buildStudyPlan } from "@/features/study-plan/plan";
import { VoicePanel } from "@/features/voice/voice-panel";

const spring = { type: "spring" as const, stiffness: 240, damping: 24 };

const voicePrompts: Array<{ text: string; icon: LucideIcon }> = [
  { text: "Quiz me on mitosis", icon: Brain },
  { text: "Focus 25 minutes", icon: Clock3 },
  { text: "What should I study?", icon: Compass },
  { text: "Read my progress", icon: Flame },
];

const portals = [
  { href: "/library", label: "New note", icon: BookOpen, tone: "violet" as const },
  { href: "/flashcards", label: "Cards", icon: Layers3, tone: "coral" as const },
  { href: "/quiz", label: "Quiz", icon: Brain, tone: "aqua" as const },
  { href: "/focus", label: "Focus", icon: Clock3, tone: "amber" as const },
];

function useOrbitEntrance(index: number, side: "left" | "right") {
  const reduced = useReducedMotion();
  const from = side === "left" ? -24 : 24;
  if (reduced) {
    return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } };
  }
  return {
    initial: { opacity: 0, x: from, y: 12, scale: 0.96 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    transition: { ...spring, delay: 0.14 + index * 0.08 },
  };
}

function VoicePaletteCard() {
  const entrance = useOrbitEntrance(0, "left");
  return (
    <motion.article className="orbit-card orbit-palette" {...entrance}>
      <div className="orbit-card-head">
        <span className="orbit-eyebrow"><MicVocal size={11} /> Voice palette</span>
        <p className="orbit-title">Try saying</p>
      </div>
      <div className="orbit-chip-cloud">
        {voicePrompts.map((prompt, idx) => (
          <motion.span
            className="orbit-chip-bubble"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            key={prompt.text}
            transition={{ delay: 0.32 + idx * 0.06, ...spring }}
          >
            <prompt.icon size={12} />
            <span>{prompt.text}</span>
          </motion.span>
        ))}
      </div>
      <p className="orbit-caption">Shift + Space works from anywhere.</p>
    </motion.article>
  );
}

function PortalsCard() {
  const entrance = useOrbitEntrance(1, "left");
  const reduced = useReducedMotion();
  return (
    <motion.article className="orbit-card orbit-portals" {...entrance}>
      <div className="orbit-card-head">
        <span className="orbit-eyebrow"><Zap size={11} /> Shortcuts</span>
        <p className="orbit-title">Portals</p>
      </div>
      <div className="orbit-portal-grid">
        {portals.map((portal, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            key={portal.href}
            transition={{ delay: 0.36 + idx * 0.05, ...spring }}
            whileHover={reduced ? undefined : { y: -3 }}
            whileTap={reduced ? undefined : { scale: 0.94 }}
          >
            <Link className="orbit-portal" data-tone={portal.tone} href={portal.href}>
              <span className="orbit-portal-icon"><portal.icon size={16} /></span>
              <strong>{portal.label}</strong>
              <ArrowUpRight aria-hidden="true" className="orbit-portal-arrow" size={13} />
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.article>
  );
}

function NextStepCard() {
  const entrance = useOrbitEntrance(0, "right");
  const { flashcards } = useFlashcards();
  const { notes } = useNotes();
  const { sessions, current } = useFocusSession();
  const { summary } = useProgress();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const plan = useMemo(() => {
    const dueCards = flashcards.filter((card) => Date.parse(card.due) <= now).length;
    const quizzesCount = new Set(flashcards.map((card) => card.note_id)).size;
    return buildStudyPlan({
      dueCards,
      notesCount: notes.length,
      quizzesCount,
      hasOpenFocus: Boolean(current) || sessions.some((session) => session.status === "active" || session.status === "paused"),
      summary,
    });
  }, [current, flashcards, notes.length, now, sessions, summary]);

  const step = plan.steps[0];
  return (
    <motion.article className="orbit-card orbit-next" {...entrance}>
      <div className="orbit-card-head">
        <span className="orbit-eyebrow"><Compass size={11} /> Next up</span>
        <p className="orbit-title">{plan.headline}</p>
      </div>
      <p className="orbit-step-headline">{step.title}</p>
      <p className="orbit-step-body">{step.detail}</p>
      <div className="orbit-step-actions">
        <span className="orbit-time-badge"><Clock3 size={11} /> {step.minutes} min</span>
        <Link className="orbit-step-cta" href={step.href}>
          Begin
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </motion.article>
  );
}

function PulseCard() {
  const entrance = useOrbitEntrance(1, "right");
  const { summary } = useProgress();
  const max = Math.max(1, ...summary.weekly.map((day) => day.count));
  return (
    <motion.article className="orbit-card orbit-pulse" {...entrance}>
      <div className="orbit-card-head">
        <div className="orbit-pulse-head">
          <span className="orbit-eyebrow"><Flame size={11} /> Today&apos;s pulse</span>
          <p className="orbit-title">{summary.streak}d streak</p>
        </div>
        <div className="orbit-pulse-bars" aria-hidden="true">
          {summary.weekly.map((day, idx) => (
            <motion.span
              animate={{ scaleY: Math.max(0.12, day.count / max) }}
              initial={{ scaleY: 0.1 }}
              key={day.date}
              style={{ transformOrigin: "bottom" }}
              transition={{ delay: 0.4 + idx * 0.04, duration: 0.55, ease: "easeOut" }}
            />
          ))}
        </div>
      </div>
      <div className="orbit-pulse-stats">
        <div>
          <strong>{summary.today.cardsReviewed}</strong>
          <small><Layers3 size={11} /> cards</small>
        </div>
        <div>
          <strong>{summary.today.focusMinutes}m</strong>
          <small><Clock3 size={11} /> focused</small>
        </div>
        <div>
          <strong>{summary.quizAccuracy === null ? "—" : `${summary.quizAccuracy}%`}</strong>
          <small><Target size={11} /> quiz</small>
        </div>
      </div>
    </motion.article>
  );
}

function AchievementCard() {
  const entrance = useOrbitEntrance(2, "right");
  const { summary } = useProgress();
  const closest = useMemo(() => {
    const unfinished = summary.achievements.filter((achievement) => !achievement.achieved);
    if (!unfinished.length) return summary.achievements[0] ?? null;
    return [...unfinished].sort((a, b) => (b.progress / b.target) - (a.progress / a.target))[0];
  }, [summary.achievements]);
  if (!closest) return null;
  const percent = Math.max(0, Math.min(100, Math.round((closest.progress / closest.target) * 100)));

  return (
    <motion.article className="orbit-card orbit-achievement" {...entrance}>
      <div className="orbit-card-head">
        <span className="orbit-eyebrow"><Award size={11} /> Milestone</span>
        <p className="orbit-title">{closest.label}</p>
      </div>
      <div className="orbit-achievement-body">
        <div className="orbit-ring" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${closest.label} progress`} style={{ ["--orbit-ring" as string]: `${percent}%` }}>
          <span>{percent}%</span>
        </div>
        <div>
          <small>{closest.description}</small>
          <div className="orbit-achievement-track" aria-hidden="true">
            <motion.span animate={{ width: `${percent}%` }} initial={{ width: 0 }} transition={{ delay: 0.5, duration: 0.7 }} />
          </div>
          <span className="orbit-achievement-count">{closest.progress}/{closest.target}</span>
        </div>
      </div>
    </motion.article>
  );
}

function MascotAmbience() {
  const reduced = useReducedMotion();
  const { state, amplitude } = useMascot();
  return (
    <div className="mascot-ambience" aria-hidden="true">
      <motion.span
        animate={reduced ? { opacity: 0.5 } : { opacity: [0.42, 0.5 + Math.min(1, amplitude) * 0.18, 0.42], scale: [0.96, 1 + Math.min(1, amplitude) * 0.04, 0.96] }}
        className="mascot-ambience-glow"
        data-presence={state.presence}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="mascot-ambience-stage" />
    </div>
  );
}

export function HomeOrbit() {
  return (
    <section className="home-orbit" aria-label="Inko workspace">
      <div className="orbit-column orbit-left" aria-label="Voice palette and shortcuts">
        <VoicePaletteCard />
        <PortalsCard />
      </div>

      <div className="orbit-center">
        <div className="mascot-shell">
          <MascotAmbience />
          <MascotStage />
        </div>
        <VoicePanel />
      </div>

      <div className="orbit-column orbit-right" aria-label="Live study status">
        <NextStepCard />
        <PulseCard />
        <AchievementCard />
      </div>

      <motion.span
        animate={{ opacity: 1, y: 0 }}
        className="orbit-hint"
        initial={{ opacity: 0, y: 6 }}
        transition={{ delay: 0.9, ...spring }}
      >
        <Sparkles size={12} /> Say a topic or press Shift + Space
      </motion.span>
    </section>
  );
}
