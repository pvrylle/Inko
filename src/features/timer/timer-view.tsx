"use client";

import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ContentTopbar } from "@/components/layout/content-topbar";
import { useOptionalProjects } from "@/features/projects/project-provider";

type TimerState = { duration: number; remaining: number; endsAt: number | null; status: "idle" | "running" | "paused" | "done" };
const STORAGE_KEY = "inko.workspace.timer";
const initialTimer: TimerState = { duration: 1500, remaining: 1500, endsAt: null, status: "idle" };

function readTimer(): TimerState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialTimer;
    const saved = JSON.parse(raw) as TimerState;
    if (!Number.isFinite(saved.duration) || saved.duration < 1 || saved.duration > 10800) return initialTimer;
    if (saved.status === "running" && saved.endsAt) {
      const remaining = Math.max(0, Math.ceil((saved.endsAt - Date.now()) / 1000));
      return { ...saved, remaining, status: remaining ? "running" : "done" };
    }
    return saved;
  } catch {
    return initialTimer;
  }
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function TimerView() {
  const projects = useOptionalProjects();
  const [timer, setTimer] = useState<TimerState>(initialTimer);
  const [minutes, setMinutes] = useState("25");

  const save = useCallback((next: TimerState) => {
    setTimer(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Storage can be unavailable. */ }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = readTimer();
      const requested = Number(new URLSearchParams(window.location.search).get("seconds"));
      if (Number.isInteger(requested) && requested > 0 && requested <= 10800 && (saved.duration !== requested || saved.status === "idle" || saved.status === "done")) {
        save({ duration: requested, remaining: requested, endsAt: Date.now() + requested * 1000, status: "running" });
        setMinutes(String(Math.ceil(requested / 60)));
      } else {
        setTimer(saved);
        setMinutes(String(Math.ceil(saved.duration / 60)));
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [save]);

  useEffect(() => {
    if (timer.status !== "running" || !timer.endsAt) return;
    const tick = () => setTimer((current) => {
      if (current.status !== "running" || !current.endsAt) return current;
      const remaining = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000));
      if (remaining === current.remaining) return current;
      if (remaining === 0) {
        const done: TimerState = { ...current, remaining: 0, endsAt: null, status: "done" };
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(done)); } catch { /* Storage can be unavailable. */ }
        return done;
      }
      return { ...current, remaining };
    });
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [timer.endsAt, timer.status]);

  const start = (seconds: number) => {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 10800) return;
    save({ duration: seconds, remaining: seconds, endsAt: Date.now() + seconds * 1000, status: "running" });
    projects?.addActivity("timer", `${formatTime(seconds)} timer`, "/timer");
  };

  const toggle = () => {
    if (timer.status === "running") save({ ...timer, endsAt: null, status: "paused" });
    else if (timer.status === "paused") save({ ...timer, endsAt: Date.now() + timer.remaining * 1000, status: "running" });
    else start(timer.duration);
  };

  return (
    <div className="activity-workspace page-enter">
      <ContentTopbar />
      <div className="activity-content timer-content">
        <header className="activity-heading"><span className="workspace-eyebrow">Timer</span><h1>Make room to focus.</h1><p>Set a duration and work at your own pace.</p></header>
        <section className="timer-stage" aria-label="Timer">
          <span className="timer-state" aria-live="polite">{timer.status === "done" ? "Time is up" : timer.status === "running" ? "In progress" : timer.status === "paused" ? "Paused" : "Ready when you are"}</span>
          <strong aria-live="off" className="timer-clock" role="timer">{formatTime(timer.remaining)}</strong>
          <div aria-hidden="true" className="timer-progress"><span style={{ width: `${(1 - timer.remaining / timer.duration) * 100}%` }} /></div>
          <div className="timer-controls">
            <button className="workspace-command" onClick={toggle} type="button">{timer.status === "running" ? <><Pause size={18} /> Pause</> : <><Play size={18} /> {timer.status === "paused" ? "Resume" : "Start"}</>}</button>
            <button aria-label="Reset timer" onClick={() => save({ ...timer, remaining: timer.duration, endsAt: null, status: "idle" })} title="Reset timer" type="button"><RotateCcw size={18} /></button>
          </div>
        </section>
        <section className="timer-set" aria-labelledby="timer-set-heading"><h2 id="timer-set-heading">Duration</h2>
          <div className="timer-presets">{[5, 25, 45].map((value) => <button aria-pressed={timer.duration === value * 60} key={value} onClick={() => { setMinutes(String(value)); start(value * 60); }} type="button">{value} min</button>)}</div>
          <form onSubmit={(event) => { event.preventDefault(); start(Number(minutes) * 60); }}><label htmlFor="timer-minutes">Custom minutes</label><input id="timer-minutes" max={180} min={1} onChange={(event) => setMinutes(event.target.value)} type="number" value={minutes} /><button type="submit">Set timer <Timer size={16} /></button></form>
        </section>
      </div>
    </div>
  );
}
