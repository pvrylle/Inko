import { inkoFetch } from "@/lib/auth/api-client";
import { usesLocalStudyData } from "@/lib/data/local-study";
import { readLocalCollection, subscribeToLocalCollection, upsertLocalRecord } from "@/lib/data/local-store";
import type { FocusControlAction, FocusSession } from "@/lib/data/models";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { reconcileFocusSession, type FocusTransition } from "./focus-timer";

export type FocusResult = { session: FocusSession | null; previous_session?: FocusSession; transition?: FocusTransition; persisted: boolean; server_now: string };

function openSession(sessions: FocusSession[]) {
  return sessions.find((session) => session.status === "active" || session.status === "paused") ?? null;
}

async function withLocalFocusLock<T>(userId: string, task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(`inko-focus:${userId}`, task);
  return task();
}

async function listHostedFocusSessions() {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("focus_sessions").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as FocusSession[];
}

export async function loadFocusSessions(userId: string): Promise<{ sessions: FocusSession[]; serverNow: string }> {
  if (await usesLocalStudyData()) {
    const sessions = readLocalCollection<FocusSession>("focus-sessions", userId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const current = openSession(sessions);
    if (current) {
      const reconciled = reconcileFocusSession(current, new Date());
      if (reconciled.changed) upsertLocalRecord("focus-sessions", userId, reconciled.session);
    }
    return { sessions: readLocalCollection<FocusSession>("focus-sessions", userId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), serverNow: new Date().toISOString() };
  }

  const supabase = getBrowserSupabaseClient();
  if (supabase) {
    const response = await inkoFetch("/api/study/focus/current", { method: "POST" });
    const sync = (await response.json()) as { server_now?: string; error?: string };
    if (!response.ok) throw new Error(sync.error || "FOCUS_SYNC_FAILED");
    return { sessions: await listHostedFocusSessions(), serverNow: sync.server_now ?? new Date().toISOString() };
  }

  const sessions = readLocalCollection<FocusSession>("focus-sessions", userId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const current = openSession(sessions);
  if (current) {
    const reconciled = reconcileFocusSession(current, new Date());
    if (reconciled.changed) upsertLocalRecord("focus-sessions", userId, reconciled.session);
  }
  return { sessions: readLocalCollection<FocusSession>("focus-sessions", userId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), serverNow: new Date().toISOString() };
}

export async function startFocusSession(userId: string, minutes: number): Promise<FocusResult> {
  return withLocalFocusLock(userId, async () => {
    const local = await usesLocalStudyData();
    const current = local ? openSession(readLocalCollection<FocusSession>("focus-sessions", userId)) : null;
    const response = await inkoFetch("/api/study/focus/start", { method: "POST", body: JSON.stringify({ minutes, current_session: current ?? undefined, callId: crypto.randomUUID() }) });
    const payload = (await response.json()) as Partial<FocusResult> & { error?: string };
    if (!response.ok || !payload.session || !payload.server_now) throw new Error(payload.error || "FOCUS_START_FAILED");
    if (!payload.persisted) {
      if (payload.previous_session) upsertLocalRecord("focus-sessions", userId, payload.previous_session);
      upsertLocalRecord("focus-sessions", userId, payload.session);
    }
    return { session: payload.session, previous_session: payload.previous_session, transition: payload.transition, persisted: payload.persisted ?? false, server_now: payload.server_now };
  });
}

export async function controlFocusSession(userId: string, action: FocusControlAction): Promise<FocusResult> {
  return withLocalFocusLock(userId, async () => {
    const local = await usesLocalStudyData();
    const current = local ? openSession(readLocalCollection<FocusSession>("focus-sessions", userId)) : null;
    const response = await inkoFetch("/api/study/focus/control", { method: "POST", body: JSON.stringify({ action, current_session: current ?? undefined, callId: crypto.randomUUID() }) });
    const payload = (await response.json()) as Partial<FocusResult> & { error?: string };
    if (!response.ok || !payload.server_now) throw new Error(payload.error || "FOCUS_CONTROL_FAILED");
    if (!payload.persisted && payload.session) upsertLocalRecord("focus-sessions", userId, payload.session);
    return { session: payload.session ?? null, transition: payload.transition, persisted: payload.persisted ?? false, server_now: payload.server_now };
  });
}

export function subscribeToFocusSessions(userId: string, onChange: () => void) {
  const unsubscribeLocal = subscribeToLocalCollection("focus-sessions", userId, onChange);
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return unsubscribeLocal;
  const channel = supabase.channel(`focus:${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "focus_sessions", filter: `owner_id=eq.${userId}` }, onChange).subscribe();
  return () => {
    unsubscribeLocal();
    void supabase.removeChannel(channel);
  };
}
