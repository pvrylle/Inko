"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import type { FocusControlAction, FocusSession } from "@/lib/data/models";
import { controlFocusSession, loadFocusSessions, startFocusSession, subscribeToFocusSessions, type FocusResult } from "./focus-repository";
import { remainingFocusSeconds } from "./focus-timer";

export function useFocusSession() {
  const { userId, isReady } = useAuth();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completing = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const loaded = await loadFocusSessions(userId);
      const browserNow = Date.now();
      setSessions(loaded.sessions);
      setServerOffset(Date.parse(loaded.serverNow) - browserNow);
      setClock(browserNow);
      setError(null);
    } catch {
      setError("Your focus timer couldn't be synchronized.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isReady || !userId) return;
    const kickoff = window.setTimeout(() => void reload(), 0);
    const unsubscribe = subscribeToFocusSessions(userId, () => void reload());
    const onVisible = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearTimeout(kickoff); unsubscribe(); document.removeEventListener("visibilitychange", onVisible); };
  }, [isReady, reload, userId]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, []);

  const current = useMemo(() => sessions.find((session) => session.status === "active" || session.status === "paused") ?? null, [sessions]);
  const remaining = remainingFocusSeconds(current, clock + serverOffset);

  const applyResult = useCallback(async (result: FocusResult) => {
    const browserNow = Date.now();
    setServerOffset(Date.parse(result.server_now) - browserNow);
    setClock(browserNow);
    await reload();
    return result;
  }, [reload]);

  const start = useCallback(async (minutes: number) => {
    if (!userId) throw new Error("AUTH_REQUIRED");
    setWorking(true); setError(null);
    try { return await applyResult(await startFocusSession(userId, minutes)); }
    catch (caught) { setError("Inko couldn't start that focus session."); throw caught; }
    finally { setWorking(false); }
  }, [applyResult, userId]);

  const control = useCallback(async (action: FocusControlAction) => {
    if (!userId) throw new Error("AUTH_REQUIRED");
    setWorking(true); setError(null);
    try { return await applyResult(await controlFocusSession(userId, action)); }
    catch (caught) { setError("That timer change wasn't saved."); throw caught; }
    finally { setWorking(false); completing.current = false; }
  }, [applyResult, userId]);

  useEffect(() => {
    if (!current || current.status !== "active" || remaining > 0 || completing.current || working) return;
    completing.current = true;
    void control("complete").catch(() => undefined);
  }, [control, current, remaining, working]);

  return { sessions, current, remaining, clock: clock + serverOffset, loading, working, error, start, control };
}
