"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import type { Note } from "@/lib/data/models";
import { listNotes, subscribeToNotes } from "./notes-repository";

export function useNotes() {
  const { userId, isReady } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setNotes(await listNotes(userId));
      setError(null);
    } catch {
      setError("Your notes couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isReady || !userId) return;
    const kickoff = window.setTimeout(() => void reload(), 0);
    const unsubscribe = subscribeToNotes(userId, () => void reload());
    return () => {
      window.clearTimeout(kickoff);
      unsubscribe();
    };
  }, [isReady, reload, userId]);

  return { notes, loading, error, reload, userId };
}
