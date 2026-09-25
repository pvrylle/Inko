"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  CanvasNote,
  OpenQuestion,
  ResearchContradiction,
  ResearchFinding,
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
  if (!supabase) return [];

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_sessions" as any)
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ResearchSession[];
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
  const supabase = getBrowserSupabaseClient();
  if (!supabase) throw new Error("SUPABASE_UNAVAILABLE");

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_sessions" as any)
    .insert({ owner_id: userId, question })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ResearchSession;
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
  if (!supabase) return null;

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_sessions" as any)
    .select("*")
    .eq("id", sessionId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as ResearchSession) ?? null;
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
  if (!supabase) return [];

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_sources" as any)
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ResearchSource[];
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
  const supabase = getBrowserSupabaseClient();
  if (!supabase) throw new Error("SUPABASE_UNAVAILABLE");

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_sources" as any)
    .insert({ owner_id: userId, session_id: sessionId, ...source })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ResearchSource;
}

/**
 * Deletes a source by id (scoped to the user via RLS).
 */
export async function deleteSource(
  userId: string,
  sourceId: string,
): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) throw new Error("SUPABASE_UNAVAILABLE");

  const { error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_sources" as any)
    .delete()
    .eq("id", sourceId)
    .eq("owner_id", userId);

  if (error) throw error;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_findings" as any)
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ResearchFinding[];
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_contradictions" as any)
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ResearchContradiction[];
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_open_questions" as any)
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as OpenQuestion[];
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
  if (!supabase) return null;

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_canvas" as any)
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as CanvasNote) ?? null;
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
  const supabase = getBrowserSupabaseClient();
  if (!supabase) throw new Error("SUPABASE_UNAVAILABLE");

  const { error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("research_canvas" as any)
    .upsert(
      {
        owner_id: userId,
        session_id: sessionId,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,session_id" },
    );

  if (error) throw error;
}
