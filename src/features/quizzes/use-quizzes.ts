"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { listQuizData, subscribeToQuizzes, type QuizData } from "./quizzes-repository";

const emptyData: QuizData = { quizzes: [], questions: [], attempts: [] };

export function useQuizzes() {
  const { userId, isReady } = useAuth();
  const [data, setData] = useState<QuizData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setData(await listQuizData(userId));
      setError(null);
    } catch {
      setError("Your quizzes couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isReady || !userId) return;
    const kickoff = window.setTimeout(() => void reload(), 0);
    const unsubscribe = subscribeToQuizzes(userId, () => void reload());
    return () => { window.clearTimeout(kickoff); unsubscribe(); };
  }, [isReady, reload, userId]);

  return { ...data, loading, error, reload, userId };
}
