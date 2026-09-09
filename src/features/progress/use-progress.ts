"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { loadProgress, subscribeToProgress } from "./progress-repository";
import { emptyProgressSummary } from "./progress-summary";

export function useProgress() {
  const { userId, isReady } = useAuth();
  const [summary, setSummary] = useState(emptyProgressSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    try { setSummary(await loadProgress(userId)); setError(null); }
    catch { setError("Your progress couldn't be loaded."); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    if (!isReady || !userId) return;
    const kickoff = window.setTimeout(() => void reload(), 0);
    const unsubscribe = subscribeToProgress(userId, () => void reload());
    return () => { window.clearTimeout(kickoff); unsubscribe(); };
  }, [isReady, reload, userId]);

  return { summary, loading, error };
}
