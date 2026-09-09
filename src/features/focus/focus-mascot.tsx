"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { BookOpen, Coffee, Flame, Headphones, Music, Sparkles, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import type { FocusSession } from "@/lib/data/models";
import type { FocusScene } from "./focus-scenes";
import { remainingFocusSeconds } from "./focus-timer";

export type FocusMascotPhase = "ready" | "focusing" | "home-stretch" | "paused";

const encouragements = [
  "You're doing great.",
  "One thing at a time.",
  "Breathe. Keep going.",
  "You've earned this quiet.",
  "Inko's rooting for you.",
  "Steady wins this one.",
  "That's real progress.",
];

const transitionCopy: Record<FocusMascotPhase, string | null> = {
  ready: null,
  focusing: "Let's dig in.",
  "home-stretch": "Home stretch, you got this.",
  paused: "Take your moment.",
};

const idleTips: Record<FocusMascotPhase, string[]> = {
  ready: [
    "What are we tackling today?",
    "Pick a duration and I'll settle in.",
    "One little task at a time.",
    "I'll keep watch while you focus.",
  ],
  focusing: [
    "Locked in with you.",
    "Nice steady rhythm.",
    "The world can wait.",
    "You're building something real.",
  ],
  "home-stretch": [
    "Almost there — final push.",
    "So close. Keep the pace.",
    "You're about to close it out.",
  ],
  paused: [
    "I'll wait right here.",
    "Take a breath.",
    "Whenever you're ready.",
  ],
};

const phaseCaption: Record<FocusMascotPhase, string> = {
  ready: "Tap Inko for a boost",
  focusing: "Deep in the zone with you",
  "home-stretch": "Almost there — keep going",
  paused: "Waiting patiently by your side",
};

type FloatingIcon = { icon: LucideIcon; x: string; y: string; size: number; tone: "primary" | "coral" | "aqua" | "amber"; delay: number; duration: number };

const floatingIcons: FloatingIcon[] = [
  { icon: BookOpen, x: "8%", y: "22%", size: 17, tone: "primary", delay: 0.0, duration: 5.4 },
  { icon: Coffee, x: "84%", y: "24%", size: 15, tone: "amber", delay: 1.1, duration: 6.2 },
  { icon: Star, x: "12%", y: "72%", size: 14, tone: "aqua", delay: 0.6, duration: 5.8 },
  { icon: Music, x: "82%", y: "68%", size: 15, tone: "coral", delay: 1.6, duration: 6.6 },
  { icon: Sparkles, x: "50%", y: "8%", size: 13, tone: "primary", delay: 0.9, duration: 4.8 },
];

function computePhase(current: FocusSession | null, clock: number): FocusMascotPhase {
  if (!current) return "ready";
  if (current.status === "paused") return "paused";
  const total = Math.max(1, current.duration_minutes * 60);
  const remaining = remainingFocusSeconds(current, clock);
  const elapsedRatio = 1 - remaining / total;
  return elapsedRatio >= 0.75 ? "home-stretch" : "focusing";
}

function countSessionsToday(sessions: FocusSession[]) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const startMs = dayStart.getTime();
  return sessions.filter((session) => session.status === "completed" && session.completed_at && Date.parse(session.completed_at) >= startMs).length;
}

export function FocusMascot({
  current,
  sessions,
  clock,
  scene,
}: {
  current: FocusSession | null;
  sessions: FocusSession[];
  clock: number;
  scene: FocusScene;
}) {
  const { state, amplitude } = useMascot();
  const reduced = useReducedMotion();
  const phase = computePhase(current, clock);
  const wiggleControls = useAnimationControls();

  const [override, setOverride] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [blinking, setBlinking] = useState(false);
  const overrideTimerRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const shownPhasesRef = useRef(new Set<FocusMascotPhase>());
  const lastCompletedRef = useRef<string | null>(null);

  const todaysCount = useMemo(() => countSessionsToday(sessions), [sessions]);

  const scheduleOverride = (text: string, durationMs: number) => {
    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    if (overrideTimerRef.current) window.clearTimeout(overrideTimerRef.current);
    showTimerRef.current = window.setTimeout(() => setOverride(text), 0);
    overrideTimerRef.current = window.setTimeout(() => setOverride(null), durationMs);
  };

  // Idle tips cycle every 5.5s
  useEffect(() => {
    const timer = window.setInterval(() => setTipIndex((current) => current + 1), 5500);
    return () => window.clearInterval(timer);
  }, []);

  // Random blink every 3–7s (skipped if reduced motion)
  useEffect(() => {
    if (reduced) return;
    let openTimer: number | null = null;
    let closeTimer: number | null = null;
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 4000;
      openTimer = window.setTimeout(() => {
        setBlinking(true);
        closeTimer = window.setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 140);
      }, delay);
    };
    scheduleBlink();
    return () => {
      if (openTimer !== null) window.clearTimeout(openTimer);
      if (closeTimer !== null) window.clearTimeout(closeTimer);
    };
  }, [reduced]);

  // Phase-transition override messages
  useEffect(() => {
    if (phase === "ready") {
      shownPhasesRef.current.clear();
      return;
    }
    if (shownPhasesRef.current.has(phase)) return;
    shownPhasesRef.current.add(phase);
    const message = transitionCopy[phase];
    if (message) scheduleOverride(message, 4000);
  }, [phase]);

  // Session-completion celebration message
  useEffect(() => {
    const latest = sessions.find((session) => session.status === "completed");
    if (!latest || latest.id === lastCompletedRef.current) return;
    const previous = lastCompletedRef.current;
    lastCompletedRef.current = latest.id;
    if (previous !== null) scheduleOverride("You did it!", 5000);
  }, [sessions]);

  useEffect(() => () => {
    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    if (overrideTimerRef.current) window.clearTimeout(overrideTimerRef.current);
  }, []);

  const onTap = () => {
    const random = encouragements[Math.floor(Math.random() * encouragements.length)];
    scheduleOverride(random, 3400);
    if (!reduced) {
      void wiggleControls.start({
        rotate: [0, -7, 9, -6, 6, -3, 0],
        transition: { duration: 0.75, ease: "easeInOut" },
      });
    }
  };

  const wearingHeadphones = phase !== "ready";
  const baseEyeOpenness = phase === "paused" ? 0.55 : phase === "focusing" ? 0.85 : 1;
  const eyeOpenness = blinking ? 0.06 : baseEyeOpenness;
  const breathing = phase === "focusing" && !reduced;
  const tips = idleTips[phase];
  const activeText = override ?? tips[tipIndex % tips.length];

  return (
    <section className="focus-mascot-card" style={{ ["--scene-accent" as string]: scene.accent }}>
      <div className="focus-mascot-scene" aria-hidden="true">
        {!reduced && floatingIcons.map((item, index) => (
          <motion.span
            className="focus-mascot-icon"
            data-tone={item.tone}
            key={index}
            style={{ left: item.x, top: item.y }}
            animate={{ y: [0, -8, 0], rotate: [-6, 6, -6] }}
            transition={{ duration: item.duration, delay: item.delay, repeat: Infinity, ease: "easeInOut" }}
          >
            <item.icon size={item.size} />
          </motion.span>
        ))}
        <span className="focus-mascot-tint" />
      </div>

      <div className="focus-mascot-header">
        <div className="focus-mascot-copy">
          <p className="eyebrow"><Headphones size={11} /> Focus buddy</p>
          <small>{phaseCaption[phase]}</small>
        </div>
        {todaysCount > 0 && (
          <motion.span
            className="focus-mascot-chip"
            initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
          >
            <Flame size={11} /> {todaysCount}
          </motion.span>
        )}
      </div>

      <div className="focus-mascot-stage">
        <div className="focus-mascot-bubble" role="status" aria-live="polite">
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              initial={{ opacity: 0, y: 6 }}
              key={activeText}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {activeText}
            </motion.span>
          </AnimatePresence>
        </div>

        <motion.button
          aria-label="Tap Inko for encouragement"
          className="focus-mascot-tap"
          onClick={onTap}
          type="button"
          whileTap={reduced ? undefined : { scale: 0.94 }}
        >
          <motion.div
            animate={breathing ? { y: [0, -3, 0] } : { y: 0 }}
            className="focus-mascot-body"
            transition={breathing ? { duration: 4.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
          >
            <motion.div animate={wiggleControls} style={{ transformOrigin: "50% 60%" }}>
              <InkoMascot
                accessory={wearingHeadphones ? "headphones" : undefined}
                amplitude={amplitude}
                eyeOpenness={eyeOpenness}
                state={state}
              />
            </motion.div>
          </motion.div>
        </motion.button>
      </div>
    </section>
  );
}
