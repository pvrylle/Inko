"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import type { Flashcard } from "@/lib/data/models";
import { listFlashcards, subscribeToFlashcards } from "./flashcards-repository";

export function useFlashcards() {
  const { userId, isReady } = useAuth();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setFlashcards(await listFlashcards(userId));
      setError(null);
    } catch {
      setError("Your flashcards couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isReady || !userId) return;
    const kickoff = window.setTimeout(() => void reload(), 0);
    const unsubscribe = subscribeToFlashcards(userId, () => void reload());
    return () => {
      window.clearTimeout(kickoff);
      unsubscribe();
    };
  }, [isReady, reload, userId]);

  return { flashcards, loading, error, reload, userId };
}
