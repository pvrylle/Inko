"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  Calendar,
  CheckCircle2,
  Clock3,
  Flame,
  ListChecks,
  Pause,
  Pencil,
  Play,
  Sparkles,
  Square,
  Target,
  TimerReset,
  TreePine,
  Waves,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeading } from "@/components/ui/page-heading";
import { PageVoiceControl } from "@/features/voice/page-voice-control";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useToasts } from "@/features/toast/toast-provider";
import { FocusMascot } from "./focus-mascot";
import { focusScenes, defaultSceneId, type FocusScene } from "./focus-scenes";
import { focusProgress, formatFocusTime } from "./focus-timer";
import { useDailyGoal, useSelectedScene } from "./use-daily-goal";
import { useFocusSession } from "./use-focus-session";
import { usePublishBrief } from "@/features/page-brief/page-brief";

const presets = [15, 25, 45, 60];
const spring = { type: "spring" as const, stiffness: 240, damping: 24 };

type RingStyle = React.CSSProperties & { "--focus-progress": string };

const sceneIcons: Record<FocusScene["id"], LucideIcon> = {
  aurora: Sparkles,
  ocean: Waves,
  forest: TreePine,
  ember: Flame,
};

function todayMinutes(sessions: { completed_at: string | null; duration_minutes: number; status: string }[]) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const startMs = dayStart.getTime();
  return sessions
    .filter((session) => session.status === "completed" && session.completed_at && Date.parse(session.completed_at) >= startMs)
    .reduce((total, session) => total + session.duration_minutes, 0);
}

export function FocusView() {
  const { sessions, current, remaining, clock, loading, working, error, start, control } = useFocusSession();
  const { dispatch } = useMascot();
  const { celebrate } = useToasts();
  const { goalMinutes, setGoalMinutes } = useDailyGoal();
  const { scene, setScene } = useSelectedScene(defaultSceneId);
  const reduced = useReducedMotion();

  const [minutes, setMinutes] = useState(25);
  const lastCompletedIdRef = useRef<string | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(goalMinutes);

  const activeScene = focusScenes.find((option) => option.id === scene) ?? focusScenes[0];
  const progress = current ? focusProgress(current, clock) : 100;
  const completedSessions = useMemo(() => sessions.filter((session) => session.status === "completed"), [sessions]);
  const completedCount = completedSessions.length;
  const totalMinutes = completedSessions.reduce((sum, session) => sum + session.duration_minutes, 0);
  const averageMinutes = completedCount ? Math.round(totalMinutes / completedCount) : 0;
  const minutesToday = useMemo(() => todayMinutes(sessions), [sessions]);
  const goalPercent = Math.max(0, Math.min(100, Math.round((minutesToday / goalMinutes) * 100)));
  const history = useMemo(() => sessions.filter((session) => session.status === "completed" || session.status === "cancelled").slice(0, 5), [sessions]);
  const displaySeconds = current ? remaining : minutes * 60;
  const status = current?.status === "paused" ? "Paused" : current ? "Focusing" : "Ready";
  const endsAtLabel = current?.status === "active"
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(Date.parse(current.target_ends_at)))
    : null;

  useEffect(() => {
    dispatch({ type: "SET_MODE", mode: current ? "focus" : "normal" });
  }, [current, dispatch]);

  useEffect(() => {
    const latest = sessions.find((session) => session.status === "completed");
    if (!latest || latest.id === lastCompletedIdRef.current) return;
    const previous = lastCompletedIdRef.current;
    lastCompletedIdRef.current = latest.id;
    if (previous !== null) celebrate("Focus session complete!", `You held ${latest.duration_minutes} minutes on one thing.`);
  }, [celebrate, sessions]);

  const beginEditingGoal = () => {
    setGoalDraft(goalMinutes);
    setEditingGoal(true);
  };

  const runControl = (action: "pause" | "resume" | "stop") => {
    void control(action).catch(() => undefined);
  };

  const saveGoal = (event: React.FormEvent) => {
    event.preventDefault();
    setGoalMinutes(goalDraft);
    setEditingGoal(false);
  };

  usePublishBrief(current ? { kind: "focus", label: `Focus: ${current.duration_minutes} minutes`, detail: `The student is in a ${current.duration_minutes}-minute focus session (${current.status}).` } : null);

  const breathing = current?.status === "active" && !reduced;

  return (
    <div className="focus-page page-enter">
      <PageHeading eyebrow="One thing at a time" title="Focus with Inko" description="Your timer follows real timestamps, so reloads and sleeping tabs never lose your place." action={<PageVoiceControl />} />

      <div className="focus-layout">
        <motion.section
          className="focus-hero focus-glass"
          data-status={current?.status ?? "ready"}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring }}
          style={{ ["--scene-gradient" as string]: activeScene.gradient, ["--scene-accent" as string]: activeScene.accent }}
        >
          <div className="focus-hero-scene" aria-hidden="true" />

          <motion.div
            aria-label={`${formatFocusTime(displaySeconds)} ${status}`}
            className="focus-ring"
            role="timer"
            style={{ "--focus-progress": `${progress}%` } as RingStyle}
            animate={breathing ? { scale: [1, 1.015, 1] } : { scale: 1 }}
            transition={breathing ? { duration: 4.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
          >
            <div className="focus-ring-face">
              <span className="focus-status-chip" data-status={current?.status ?? "ready"}>
                {current?.status === "paused" ? <Pause size={11} /> : current ? <Sparkles size={11} /> : <Play size={11} />}
                {status}
              </span>
              <strong className="focus-time">{formatFocusTime(displaySeconds)}</strong>
              {endsAtLabel ? (
                <span className="focus-ends-at">Ends around {endsAtLabel}</span>
              ) : current?.status === "paused" ? (
                <span className="focus-ends-at">Timer held — resume when ready</span>
              ) : (
                <span className="focus-ends-at">{minutes} minute block</span>
              )}
            </div>
          </motion.div>

          {!current ? (
            <>
              <div className="focus-presets" role="group" aria-label="Focus duration">
                {presets.map((preset) => (
                  <motion.button
                    key={preset}
                    aria-pressed={minutes === preset}
                    className="focus-preset"
                    data-active={minutes === preset}
                    disabled={working}
                    onClick={() => setMinutes(preset)}
                    type="button"
                    whileTap={reduced ? undefined : { scale: 0.94 }}
                  >
                    <strong>{preset}</strong>
                    <small>min</small>
                  </motion.button>
                ))}
              </div>
              <button
                aria-busy={loading || working}
                aria-label="Start focus"
                className="focus-start"
                disabled={loading || working}
                onClick={() => void start(minutes).catch(() => undefined)}
                type="button"
              >
                <span className="focus-start-icon"><Play size={16} fill="currentColor" /></span>
                <span className="focus-start-label">
                  {working ? "Starting…" : "Start Focus"}
                  <small>{minutes} minute block</small>
                </span>
              </button>
            </>
          ) : (
            <div className="focus-controls" role="group" aria-label="Session controls">
              {current.status === "active" ? (
                <button className="focus-primary-btn" disabled={working} onClick={() => runControl("pause")} type="button">
                  <Pause size={18} fill="currentColor" /> Pause
                </button>
              ) : (
                <button className="focus-primary-btn" disabled={working} onClick={() => runControl("resume")} type="button">
                  <Play size={18} fill="currentColor" /> Resume
                </button>
              )}
              <button className="focus-secondary-btn" disabled={working} onClick={() => runControl("stop")} type="button">
                <Square size={16} fill="currentColor" /> End session
              </button>
            </div>
          )}

          <p className="focus-hint">
            <TimerReset size={13} />
            {current ? "Safe to close this tab — your session will keep going." : "Choose a duration and settle into one task."}
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
        </motion.section>

        <aside className="focus-aside" aria-label="Focus workspace">
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.04 }}
          >
            <FocusMascot current={current} sessions={sessions} clock={clock} scene={activeScene} />
          </motion.div>

          <motion.section
            className="focus-goal-card focus-glass"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.08 }}
          >
            <div className="focus-goal-hero">
              <div className="focus-goal-ring" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goalPercent} aria-label="Daily goal progress" style={{ ["--goal-progress" as string]: `${goalPercent}%` }}>
                <span>{goalPercent}%</span>
              </div>
              <div className="focus-goal-info">
                {!editingGoal ? (
                  <>
                    <p className="focus-goal-title">
                      <Target size={13} /> Daily Goal: <strong>{minutesToday}</strong> <span>/ {goalMinutes} min</span>
                    </p>
                    <div className="focus-goal-bar" aria-hidden="true"><span style={{ width: `${goalPercent}%` }} /></div>
                  </>
                ) : (
                  <form className="focus-goal-editor" onSubmit={saveGoal}>
                    <label className="sr-only" htmlFor="goal-minutes">Focus goal in minutes</label>
                    <input
                      id="goal-minutes"
                      max={360}
                      min={15}
                      onChange={(event) => setGoalDraft(Math.max(15, Math.min(360, Number(event.target.value) || 0)))}
                      step={5}
                      type="number"
                      value={goalDraft}
                    />
                    <span>min goal</span>
                    <button className="focus-goal-save" type="submit">Save</button>
                    <button aria-label="Cancel" className="focus-goal-cancel" onClick={() => setEditingGoal(false)} type="button"><X size={13} /></button>
                  </form>
                )}
              </div>
              {!editingGoal && (
                <button aria-label="Adjust daily goal" className="focus-goal-edit" onClick={beginEditingGoal} type="button">
                  <Pencil size={12} />
                </button>
              )}
            </div>
            <div className="focus-goal-stats">
              <span><Clock3 size={11} /> Total Mins: <strong>{totalMinutes}</strong></span>
              <span><Zap size={11} /> Avg Session: <strong>{averageMinutes}</strong></span>
              <span><CheckCircle2 size={11} /> Sessions Completed: <strong>{completedCount}</strong></span>
            </div>
          </motion.section>

          <motion.section
            className="focus-scene-card focus-glass"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.14 }}
          >
            <p className="eyebrow"><Sparkles size={11} /> Ambient scene</p>
            <div className="focus-scene-grid">
              {focusScenes.map((option) => {
                const Icon = sceneIcons[option.id];
                return (
                  <motion.button
                    aria-pressed={scene === option.id}
                    className="focus-scene-swatch"
                    data-active={scene === option.id}
                    key={option.id}
                    onClick={() => setScene(option.id)}
                    style={{ background: option.gradient, ["--scene-accent" as string]: option.accent }}
                    title={option.description}
                    type="button"
                    whileHover={reduced ? undefined : { y: -3 }}
                    whileTap={reduced ? undefined : { scale: 0.95 }}
                  >
                    <span className="focus-scene-icon" aria-hidden="true"><Icon size={16} /></span>
                    <strong>{option.label}</strong>
                  </motion.button>
                );
              })}
            </div>
            <small className="focus-scene-caption">{activeScene.description}</small>
          </motion.section>

          <motion.section
            className="focus-activity-card focus-glass"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
          >
            <p className="eyebrow"><ListChecks size={11} /> Activity log</p>
            {history.length > 0 ? (
              <ol className="focus-activity-list">
                {history.map((session, index) => {
                  const StatusIcon = session.status === "completed" ? CheckCircle2 : XCircle;
                  return (
                    <motion.li
                      data-status={session.status}
                      key={session.id}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...spring, delay: 0.24 + index * 0.05 }}
                    >
                      <span className="focus-activity-status" data-status={session.status} aria-hidden="true">
                        <StatusIcon size={13} />
                      </span>
                      <div>
                        <strong>
                          <Clock3 size={11} />
                          {session.duration_minutes}m {session.status === "completed" ? "completed" : "ended early"}
                        </strong>
                        <small>
                          <Calendar size={10} />
                          {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(session.completed_at ?? session.updated_at))}
                        </small>
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            ) : (
              <p className="focus-activity-empty">Your first session will land here.</p>
            )}
          </motion.section>
        </aside>
      </div>
    </div>
  );
}
