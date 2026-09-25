"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  listResearchSessions,
  createResearchSession,
  listSources,
  listFindings,
  listContradictions,
  listOpenQuestions,
  getCanvasNote,
  upsertCanvasNote,
  subscribeToResearchSessions,
} from "./research-repository";
import { researchQuestionSchema } from "./research-schema";
import type {
  ResearchSession,
  ResearchSource,
  ResearchFinding,
  ResearchContradiction,
  OpenQuestion,
} from "./research-schema";

// ─── Tab type ─────────────────────────────────────────────────────────────────

export type ResearchTab =
  | "overview"
  | "sources"
  | "findings"
  | "contradictions"
  | "canvas"
  | "notes"
  | "open-questions";

// ─── Activity item ────────────────────────────────────────────────────────────

export type ActivityItem = { key: string; tone: string; text: string; time: string };

// ─── Return type ──────────────────────────────────────────────────────────────

export type UseResearchReturn = {
  sessions: ResearchSession[];
  activeSession: ResearchSession | null;
  setActive: (id: string) => void;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  contradictions: ResearchContradiction[];
  openQuestions: OpenQuestion[];
  canvasContent: string;
  saveCanvas: (content: string) => Promise<void>;
  activeTab: ResearchTab;
  setActiveTab: (tab: ResearchTab) => void;
  createSession: (question: string) => Promise<void>;
  sessionError: string | null;
  loading: boolean;
  error: string | null;
  activity: ActivityItem[];
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useResearch(): UseResearchReturn {
  const { userId, isReady } = useAuth();

  // ── Session list ────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Active session + per-session data ───────────────────────────────────────
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ResearchSession | null>(null);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [contradictions, setContradictions] = useState<ResearchContradiction[]>([]);
  const [openQuestions, setOpenQuestions] = useState<OpenQuestion[]>([]);
  const [canvasContent, setCanvasContent] = useState("");

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ResearchTab>("overview");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // ── Load the full session list (Requirement 8.2) ────────────────────────────
  const reloadSessions = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listResearchSessions(userId);
      setSessions(data);
      // Auto-open the most recent project so the workspace is visible (the
      // reference always shows an open research project).
      setActiveSessionId((current) => current ?? data[0]?.id ?? null);
      setError(null);
    } catch {
      setError("Your research sessions couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Mount: initial load + realtime subscription
  useEffect(() => {
    if (!isReady || !userId) return;
    const kickoff = window.setTimeout(() => void reloadSessions(), 0);
    const unsubscribe = subscribeToResearchSessions(userId, () =>
      void reloadSessions(),
    );
    return () => {
      window.clearTimeout(kickoff);
      unsubscribe();
    };
  }, [isReady, reloadSessions, userId]);

  // ── Load per-session data when activeSessionId changes (Req 8.3) ────────────
  const loadSessionData = useCallback(
    async (sessionId: string) => {
      if (!userId) return;

      try {
        const [
          sessionData,
          sourcesData,
          findingsData,
          contradictionsData,
          openQuestionsData,
          canvasData,
        ] = await Promise.all([
          listResearchSessions(userId).then(
            (list) => list.find((s) => s.id === sessionId) ?? null,
          ),
          listSources(userId, sessionId),
          listFindings(userId, sessionId),
          listContradictions(userId, sessionId),
          listOpenQuestions(userId, sessionId),
          getCanvasNote(userId, sessionId),
        ]);

        setActiveSession(sessionData);
        setSources(sourcesData);
        setFindings(findingsData);
        setContradictions(contradictionsData);
        setOpenQuestions(openQuestionsData);
        setCanvasContent(canvasData?.content ?? "");
        setActivity([]);
      } catch {
        setError("Failed to load session data.");
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!activeSessionId) return;
    const kickoff = window.setTimeout(() => void loadSessionData(activeSessionId), 0);
    return () => window.clearTimeout(kickoff);
  }, [activeSessionId, loadSessionData]);

  // ── setActive: pick a session from the sidebar (Requirement 8.3) ────────────
  const setActive = useCallback((id: string) => {
    setActiveSessionId(id);
    setActiveTab("overview");
  }, []);

  // ── createSession (Requirements 8.11, 8.12) ──────────────────────────────────
  const createSession = useCallback(
    async (question: string) => {
      if (!userId) return;

      // Validate question length (10–500 chars)
      const result = researchQuestionSchema.safeParse(question);
      if (!result.success) {
        const issue = result.error.issues[0];
        if (issue?.code === "too_small") {
          setSessionError(
            "Research question must be at least 10 characters.",
          );
        } else if (issue?.code === "too_big") {
          setSessionError(
            "Research question must be 500 characters or fewer.",
          );
        } else {
          setSessionError("Please enter a valid research question.");
        }
        return;
      }

      setSessionError(null);
      try {
        const newSession = await createResearchSession(userId, question);
        // Optimistically prepend to the list then let realtime sync
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setActiveTab("overview");
      } catch {
        setSessionError("Failed to create research session. Please try again.");
      }
    },
    [userId],
  );

  // ── saveCanvas ──────────────────────────────────────────────────────────────
  const saveCanvas = useCallback(
    async (content: string) => {
      if (!userId || !activeSessionId) return;
      await upsertCanvasNote(userId, activeSessionId, content);
      setCanvasContent(content);
    },
    [userId, activeSessionId],
  );

  return {
    sessions,
    activeSession,
    setActive,
    sources,
    findings,
    contradictions,
    openQuestions,
    canvasContent,
    saveCanvas,
    activeTab,
    setActiveTab,
    createSession,
    sessionError,
    loading,
    error,
    activity,
  };
}
