import type { FocusControlAction, FocusSession } from "@/lib/data/models";

export type FocusTransition = "started" | "already_open" | "paused" | "already_paused" | "resumed" | "already_active" | "cancelled" | "completed" | "not_due" | "no_open_session";

export function remainingFocusSeconds(session: FocusSession | null, nowMs: number): number {
  if (!session || session.status === "completed" || session.status === "cancelled") return 0;
  const effectiveNow = session.status === "paused" && session.paused_at ? Date.parse(session.paused_at) : nowMs;
  return Math.ceil(Math.max(0, Date.parse(session.target_ends_at) - effectiveNow) / 1_000);
}

export function focusProgress(session: FocusSession | null, nowMs: number): number {
  if (!session) return 0;
  const total = session.duration_minutes * 60;
  if (!total) return 0;
  return Math.max(0, Math.min(100, (remainingFocusSeconds(session, nowMs) / total) * 100));
}

export function formatFocusTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function createFocusSession(ownerId: string, durationMinutes: number, now: Date, id: string = crypto.randomUUID()): FocusSession {
  const timestamp = now.toISOString();
  return {
    id,
    owner_id: ownerId,
    duration_minutes: durationMinutes,
    started_at: timestamp,
    target_ends_at: new Date(now.getTime() + durationMinutes * 60_000).toISOString(),
    paused_at: null,
    accumulated_pause_seconds: 0,
    completed_at: null,
    status: "active",
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function reconcileFocusSession(session: FocusSession, now: Date): { session: FocusSession; changed: boolean } {
  if (session.status !== "active" || Date.parse(session.target_ends_at) > now.getTime()) return { session, changed: false };
  return {
    session: { ...session, status: "completed", completed_at: session.target_ends_at, paused_at: null, updated_at: now.toISOString() },
    changed: true,
  };
}

export function transitionFocusSession(session: FocusSession | null, action: FocusControlAction, now: Date): { session: FocusSession | null; transition: FocusTransition } {
  if (!session || (session.status !== "active" && session.status !== "paused")) return { session, transition: "no_open_session" };
  const reconciled = reconcileFocusSession(session, now);
  if (reconciled.changed) return { session: reconciled.session, transition: "completed" };
  const timestamp = now.toISOString();

  if (action === "pause") {
    if (session.status === "paused") return { session, transition: "already_paused" };
    return { session: { ...session, status: "paused", paused_at: timestamp, updated_at: timestamp }, transition: "paused" };
  }
  if (action === "resume") {
    if (session.status === "active") return { session, transition: "already_active" };
    const pauseMs = Math.max(0, now.getTime() - Date.parse(session.paused_at ?? timestamp));
    return {
      session: {
        ...session,
        status: "active",
        paused_at: null,
        target_ends_at: new Date(Date.parse(session.target_ends_at) + pauseMs).toISOString(),
        accumulated_pause_seconds: session.accumulated_pause_seconds + Math.floor(pauseMs / 1_000),
        updated_at: timestamp,
      },
      transition: "resumed",
    };
  }
  if (action === "stop") {
    const pauseMs = session.status === "paused" ? Math.max(0, now.getTime() - Date.parse(session.paused_at ?? timestamp)) : 0;
    return {
      session: {
        ...session,
        status: "cancelled",
        paused_at: null,
        target_ends_at: new Date(Date.parse(session.target_ends_at) + pauseMs).toISOString(),
        accumulated_pause_seconds: session.accumulated_pause_seconds + Math.floor(pauseMs / 1_000),
        updated_at: timestamp,
      },
      transition: "cancelled",
    };
  }
  return { session, transition: "not_due" };
}
