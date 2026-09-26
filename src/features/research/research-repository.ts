"use client";

import { inkoFetch } from "@/lib/auth/api-client";
import { readDemo, saveDemo } from "@/lib/data/demo-memory";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  CanvasNote,
  OpenQuestion,
  ResearchContradiction,
  ResearchFinding,
  ResearchNote,
  ResearchSession,
  ResearchSource,
  SourceTag,
} from "./research-schema";

// ─── Sessions ─────────────────────────────────────────────────────────────────

/**
 * Returns all research sessions for the user, ordered by most recently updated
 * first (Requirement 8.2).
 */
export async function listResearchSessions(
  userId: string,
): Promise<ResearchSession[]> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return readDemo<ResearchSession>("research-sessions", userId);

  const { data, error } = await supabase
    .from("research_sessions")
    .select("id, owner_id, question, title, description, status, created_at, updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Creates a new research session with the given question. The question must
 * already be validated against `researchQuestionSchema` before calling this
 * function (Requirement 8.11).
 */
export async function createResearchSession(
  userId: string,
  question: string,
): Promise<ResearchSession> {
  const response = await inkoFetch("/api/research/sessions", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error("CREATE_FAILED");
  const session = (await response.json()) as ResearchSession;
  if (!getBrowserSupabaseClient()) saveDemo("research-sessions", userId, session);
  return session;
}

/**
 * Returns a single research session by id scoped to the user, or `null` if not
 * found (Requirement 8.3).
 */
export async function getResearchSession(
  userId: string,
  sessionId: string,
): Promise<ResearchSession | null> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return readDemo<ResearchSession>("research-sessions", userId).find((session) => session.id === sessionId) ?? null;

  const { data, error } = await supabase
    .from("research_sessions")
    .select("id, owner_id, question, title, description, status, created_at, updated_at")
    .eq("id", sessionId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Subscribes to realtime changes on the user's research sessions. Returns an
 * unsubscribe function.
 */
export function subscribeToResearchSessions(
  userId: string,
  onChange: () => void,
): () => void {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel(`research_sessions:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "research_sessions",
        filter: `owner_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// ─── Sources ──────────────────────────────────────────────────────────────────

/**
 * Returns all sources for a given session (Requirement 8.5).
 */
export async function listSources(
  userId: string,
  sessionId: string,
): Promise<ResearchSource[]> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return readDemo<ResearchSource>(`research-sources:${sessionId}`, userId);

  const { data, error } = await supabase
    .from("research_sources_public")
    .select("id, session_id, owner_id, title, url, type, tag, meta, created_at")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ResearchSource[];
}

/**
 * Creates a new source record attached to the given session.
 */
export async function createSource(
  userId: string,
  sessionId: string,
  source: {
    title: string;
    url: string | null;
    type: "document" | "url" | "file";
    tag: SourceTag;
  },
): Promise<ResearchSource> {
  const response = await inkoFetch(`/api/research/sessions/${sessionId}/sources`, {
    method: "POST",
    body: JSON.stringify(source),
  });
  if (!response.ok) throw new Error("SOURCE_CREATE_FAILED");
  const created = (await response.json()) as ResearchSource;
  if (!getBrowserSupabaseClient()) saveDemo(`research-sources:${sessionId}`, userId, created);
  return created;
}

/**
 * Deletes a source by id (scoped to the user via RLS).
 */
export async function deleteSource(
  userId: string,
  sourceId: string,
): Promise<void> {
  const response = await inkoFetch(`/api/research/sources/${sourceId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("SOURCE_DELETE_FAILED");
}

// ─── Findings ─────────────────────────────────────────────────────────────────

/**
 * Returns all findings for a given session (Requirement 8.6).
 */
export async function listFindings(
  userId: string,
  sessionId: string,
): Promise<ResearchFinding[]> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("research_findings")
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Contradictions ───────────────────────────────────────────────────────────

/**
 * Returns all contradictions for a given session (Requirement 8.7).
 */
export async function listContradictions(
  userId: string,
  sessionId: string,
): Promise<ResearchContradiction[]> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("research_contradictions")
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Open Questions ───────────────────────────────────────────────────────────

/**
 * Returns all open questions for a given session (Requirement 8.8).
 */
export async function listOpenQuestions(
  userId: string,
  sessionId: string,
): Promise<OpenQuestion[]> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("research_open_questions")
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

/**
 * Returns the canvas note for a given session, or `null` if none exists
 * (Requirement 8.13).
 */
export async function getCanvasNote(
  userId: string,
  sessionId: string,
): Promise<CanvasNote | null> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return readDemo<CanvasNote>("research-canvas", userId).find((note) => note.session_id === sessionId) ?? null;
  }

  const { data, error } = await supabase
    .from("research_canvas")
    .select("id, session_id, owner_id, content, updated_at")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Creates or updates the canvas note for a given session (Requirement 8.13).
 * Uses upsert on the composite (owner_id, session_id) natural key.
 */
export async function upsertCanvasNote(
  userId: string,
  sessionId: string,
  content: string,
): Promise<void> {
  const response = await inkoFetch(`/api/research/sessions/${sessionId}/canvas`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error("CANVAS_SAVE_FAILED");
  if (!getBrowserSupabaseClient()) {
    saveDemo("research-canvas", userId, {
      id: sessionId,
      session_id: sessionId,
      owner_id: userId,
      content,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function getResearchNote(userId: string, sessionId: string): Promise<ResearchNote | null> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return readDemo<ResearchNote>("research-notes", userId).find((note) => note.session_id === sessionId) ?? null;
  }
  const { data, error } = await supabase
    .from("research_notes")
    .select("id, session_id, owner_id, content_markdown, updated_at")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
