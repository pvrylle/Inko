"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getLocalResearchProject } from "@/lib/data/research-local";
import {
  listResearchSessions,
  createResearchSession,
  listSources,
  listFindings,
  listContradictions,
  listOpenQuestions,
  getCanvasNote,
  getResearchNote,
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
  setActive: (id: string, tab?: ResearchTab) => void;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  contradictions: ResearchContradiction[];
  openQuestions: OpenQuestion[];
  canvasContent: string;
  noteMarkdown: string;
  saveCanvas: (content: string) => Promise<void>;
  activeTab: ResearchTab;
  setActiveTab: (tab: ResearchTab) => void;
  createSession: (question: string) => Promise<ResearchSession | undefined>;
  startNewProject: () => void;
  sessionError: string | null;
  loading: boolean;
  error: string | null;
  activity: ActivityItem[];
};

function syncResearchUrl(sessionId: string | null, tab: ResearchTab) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (sessionId) url.searchParams.set("session", sessionId);
  else url.searchParams.delete("session");
  if (sessionId && tab !== "overview") url.searchParams.set("tab", tab);
  else url.searchParams.delete("tab");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

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
  const [noteMarkdown, setNoteMarkdown] = useState("");

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
          noteData,
        ] = await Promise.all([
          listResearchSessions(userId).then(
            (list) => list.find((s) => s.id === sessionId) ?? null,
          ),
          listSources(userId, sessionId),
          listFindings(userId, sessionId),
          listContradictions(userId, sessionId),
          listOpenQuestions(userId, sessionId),
          getCanvasNote(userId, sessionId),
          getResearchNote(userId, sessionId),
        ]);

        setActiveSession(sessionData);
        setSources(sourcesData);
        setFindings(findingsData);
        setContradictions(contradictionsData);
        setOpenQuestions(openQuestionsData);
        setCanvasContent(canvasData?.content ?? "");
        setNoteMarkdown(noteData?.content_markdown ?? "");
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

  useEffect(() => {
    if (!activeSessionId || activeSession?.status !== "analyzing") return;
    const timer = window.setInterval(() => void loadSessionData(activeSessionId), 2500);
    return () => window.clearInterval(timer);
  }, [activeSession?.status, activeSessionId, loadSessionData]);

  const chooseTab = useCallback((tab: ResearchTab) => {
    setActiveTab(tab);
    syncResearchUrl(activeSessionId, tab);
  }, [activeSessionId]);

  // ── setActive: pick a session from the sidebar (Requirement 8.3) ────────────
  const setActive = useCallback((id: string, tab?: ResearchTab) => {
    const nextTab = tab ?? "overview";
    setActiveSession(sessions.find((session) => session.id === id) ?? null);
    setActiveSessionId(id);
    setSources([]);
    setFindings([]);
    setContradictions([]);
    setOpenQuestions([]);
    setCanvasContent("");
    setNoteMarkdown("");
    setActiveTab(nextTab);
    syncResearchUrl(id, nextTab);
  }, [sessions]);

  const startNewProject = useCallback(() => {
    setActiveSessionId(null);
    setActiveSession(null);
    setSources([]);
    setFindings([]);
    setContradictions([]);
    setOpenQuestions([]);
    setCanvasContent("");
    setNoteMarkdown("");
    setActiveTab("overview");
    syncResearchUrl(null, "overview");
  }, []);

  // ── createSession (Requirements 8.11, 8.12) ──────────────────────────────────
  const createSession = useCallback(
    async (question: string) => {
      if (!userId) return undefined;

      // Validate topic or question length (2–500 chars)
      const result = researchQuestionSchema.safeParse(question);
      if (!result.success) {
        const issue = result.error.issues[0];
        if (issue?.code === "too_small") {
          setSessionError(
            "Enter at least two characters for a topic.",
          );
        } else if (issue?.code === "too_big") {
          setSessionError(
            "Research question must be 500 characters or fewer.",
          );
        } else {
          setSessionError("Please enter a valid research question.");
        }
        return undefined;
      }

      setSessionError(null);
      try {
        const newSession = await createResearchSession(userId, question);
        const project = getLocalResearchProject(userId, newSession.id);
        setSessions((prev) => [newSession, ...prev.filter((session) => session.id !== newSession.id)]);
        setActiveSession(newSession);
        setSources(project?.sources ?? []);
        setFindings(project?.findings ?? []);
        setContradictions(project?.contradictions ?? []);
        setOpenQuestions(project?.openQuestions ?? []);
        setNoteMarkdown(project?.note?.content_markdown ?? "");
        setCanvasContent(project?.canvas?.content ?? "");
        setActiveSessionId(newSession.id);
        setActiveTab("overview");
        syncResearchUrl(newSession.id, "overview");
        return newSession;
      } catch (caught) {
        const code = caught instanceof Error ? caught.message : "CREATE_FAILED";
        if (code === "GUEST_LIMIT") {
          setSessionError("You've used today's guest research limit. Sign in to keep going.");
        } else {
          setSessionError("Failed to create research session. Please try again.");
        }
        return undefined;
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
    noteMarkdown,
    saveCanvas,
    activeTab,
    setActiveTab: chooseTab,
    createSession,
    startNewProject,
    sessionError,
    loading,
    error,
    activity,
  };
}
