"use client";

import { Flame, Pause, Play, RotateCcw, Sparkles, Square, Target } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeading } from "@/components/ui/page-heading";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useToasts } from "@/features/toast/toast-provider";
import { focusScenes, defaultSceneId } from "./focus-scenes";
import { focusProgress, formatFocusTime } from "./focus-timer";
import { useDailyGoal, useSelectedScene } from "./use-daily-goal";
import { useFocusSession } from "./use-focus-session";

const presets = [25, 45, 60];

type RingStyle = React.CSSProperties & { "--focus-progress": string };

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
  const [minutes, setMinutes] = useState(25);
  const lastCompletedIdRef = useRef<string | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(goalMinutes);

  const activeScene = focusScenes.find((option) => option.id === scene) ?? focusScenes[0];
  const progress = current ? focusProgress(current, clock) : 100;
  const completedCount = sessions.filter((session) => session.status === "completed").length;
  const minutesToday = useMemo(() => todayMinutes(sessions), [sessions]);
  const goalPercent = Math.max(0, Math.min(100, Math.round((minutesToday / goalMinutes) * 100)));
  const history = useMemo(() => sessions.filter((session) => session.status === "completed" || session.status === "cancelled").slice(0, 6), [sessions]);

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

  return (
    <div className="content-page page-enter" data-scene={activeScene.id} style={{ ["--scene-gradient" as string]: activeScene.gradient, ["--scene-accent" as string]: activeScene.accent }}>
      <PageHeading eyebrow="One thing at a time" title="Focus with Inko" description="Your timer follows real timestamps, so reloads and sleeping tabs never lose your place." />

      <section className="focus-goal" aria-label="Daily focus goal">
        <div className="focus-goal-header">
          <span className="focus-goal-icon"><Target size={18} /></span>
          <div>
            <p className="eyebrow">Daily goal</p>
            <strong>{minutesToday} of {goalMinutes} minutes</strong>
          </div>
          {!editingGoal ? (
            <button className="text-button" onClick={beginEditingGoal} type="button">Edit</button>
          ) : (
            <form className="goal-editor" onSubmit={saveGoal}>
              <label className="sr-only" htmlFor="goal-minutes">Focus goal in minutes</label>
              <input id="goal-minutes" max={360} min={15} onChange={(event) => setGoalDraft(Math.max(15, Math.min(360, Number(event.target.value) || 0)))} step={5} type="number" value={goalDraft} />
              <button className="secondary-button" type="submit">Save</button>
            </form>
          )}
        </div>
        <div className="focus-goal-track" aria-hidden="true"><span style={{ width: `${goalPercent}%` }} /></div>
        <small className="focus-goal-caption">{goalPercent >= 100 ? "Goal hit — anything else is bonus." : `${goalPercent}% there — one 25 minute block gets you to ${Math.min(100, goalPercent + Math.round((25 / goalMinutes) * 100))}%.`}</small>
      </section>

      <section className="focus-scenes" aria-label="Ambient scene">
        {focusScenes.map((option) => (
          <button
            aria-pressed={scene === option.id}
            className="focus-scene"
            data-active={scene === option.id}
            key={option.id}
            onClick={() => setScene(option.id)}
            style={{ background: option.gradient, ["--scene-accent" as string]: option.accent }}
            type="button"
          >
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </button>
        ))}
      </section>

      <section className="timer-card" aria-busy={loading}>
        <div aria-label={`${formatFocusTime(current ? remaining : minutes * 60)} ${current?.status ?? "ready"}`} className="timer-ring" data-paused={current?.status === "paused"} role="timer" style={{ "--focus-progress": `${progress}%` } as RingStyle}>
          <div><strong>{formatFocusTime(current ? remaining : minutes * 60)}</strong><span>{current?.status === "paused" ? "paused" : current ? "focus" : "ready"}</span></div>
        </div>

        {!current ? (
          <>
            <div className="timer-presets" aria-label="Focus duration">
              {presets.map((preset) => <button aria-pressed={minutes === preset} key={preset} data-active={minutes === preset} disabled={working} onClick={() => setMinutes(preset)}>{preset} min</button>)}
            </div>
            <button className="primary-button large" disabled={loading || working} onClick={() => void start(minutes).catch(() => undefined)}><Play size={20} fill="currentColor" /> {working ? "Starting…" : "Start focus"}</button>
          </>
        ) : (
          <div className="focus-controls">
            {current.status === "active" ? <button className="primary-button large" disabled={working} onClick={() => runControl("pause")}><Pause size={19} fill="currentColor" /> Pause</button> : <button className="primary-button large" disabled={working} onClick={() => runControl("resume")}><Play size={19} fill="currentColor" /> Resume</button>}
            <button className="secondary-button" disabled={working} onClick={() => runControl("stop")}><Square size={17} fill="currentColor" /> End session</button>
          </div>
        )}

        <p className="focus-persistence"><RotateCcw size={14} /> {current ? "Safe to close this tab — your session will continue." : completedCount ? `${completedCount} focus session${completedCount === 1 ? "" : "s"} completed.` : "Choose a duration and settle into one task."}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>

      {history.length > 0 && (
        <section className="focus-history" aria-label="Recent focus sessions">
          <div className="section-title-row">
            <div><p className="eyebrow">Momentum</p><h2>Recent sessions</h2></div>
            <span className="focus-history-summary"><Flame size={14} /> {completedCount} completed</span>
          </div>
          <div className="focus-history-grid">
            {history.map((session) => (
              <article className="focus-history-item" data-status={session.status} key={session.id}>
                <span className="focus-history-icon"><Sparkles size={14} /></span>
                <div>
                  <strong>{session.duration_minutes}m {session.status === "completed" ? "focused" : "ended"}</strong>
                  <small>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(session.completed_at ?? session.updated_at))}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
