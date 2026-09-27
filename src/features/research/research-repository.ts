"use client";

import { inkoFetch } from "@/lib/auth/api-client";
import { usesLocalStudyData } from "@/lib/data/local-study";
import {
  getLocalResearchProject,
  listLocalResearchProjects,
  patchLocalResearchProject,
  saveLocalResearchProject,
  subscribeToLocalResearch,
  type ResearchProject,
} from "@/lib/data/research-local";
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

type SessionCreatePayload = ResearchSession & Partial<ResearchProject> & { session?: ResearchSession };

function projectFromPayload(payload: SessionCreatePayload, fallbackSession: ResearchSession): ResearchProject {
  const session = payload.session?.id ? payload.session : fallbackSession;
  return {
    session,
    sources: payload.sources ?? [],
    findings: payload.findings ?? [],
    contradictions: payload.contradictions ?? [],
    openQuestions: payload.openQuestions ?? [],
    note: payload.note ?? null,
    canvas: payload.canvas ?? null,
  };
}

export async function listResearchSessions(userId: string): Promise<ResearchSession[]> {
  if (await usesLocalStudyData()) {
    return listLocalResearchProjects(userId).map((project) => project.session);
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return listLocalResearchProjects(userId).map((project) => project.session);

  const { data, error } = await supabase
    .from("research_sessions")
    .select("id, owner_id, question, title, description, status, created_at, updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createResearchSession(
  userId: string,
  question: string,
): Promise<ResearchSession> {
  const response = await inkoFetch("/api/research/sessions", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
  const payload = (await response.json()) as SessionCreatePayload & { error?: string };
  if (!response.ok) throw new Error(payload.error || "CREATE_FAILED");

  const session = payload.session?.id ? payload.session : payload;
  if (!session.id) throw new Error("CREATE_FAILED");
  const project = projectFromPayload(payload, session);
  if (await usesLocalStudyData()) saveLocalResearchProject(userId, project);
  return project.session;
}

export async function getResearchSession(
  userId: string,
  sessionId: string,
): Promise<ResearchSession | null> {
  if (await usesLocalStudyData()) {
    return getLocalResearchProject(userId, sessionId)?.session ?? null;
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return getLocalResearchProject(userId, sessionId)?.session ?? null;

  const { data, error } = await supabase
    .from("research_sessions")
    .select("id, owner_id, question, title, description, status, created_at, updated_at")
    .eq("id", sessionId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function subscribeToResearchSessions(
  userId: string,
  onChange: () => void,
): () => void {
  const unsubscribeLocal = subscribeToLocalResearch(userId, onChange);
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return unsubscribeLocal;

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
    unsubscribeLocal();
    void supabase.removeChannel(channel);
  };
}

export async function listSources(
  userId: string,
  sessionId: string,
): Promise<ResearchSource[]> {
  if (await usesLocalStudyData()) {
    return getLocalResearchProject(userId, sessionId)?.sources ?? [];
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return getLocalResearchProject(userId, sessionId)?.sources ?? [];

  const { data, error } = await supabase
    .from("research_sources_public")
    .select("id, session_id, owner_id, title, url, type, tag, meta, created_at")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ResearchSource[];
}

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
  const created = (await response.json()) as ResearchSource & { error?: string };
  if (!response.ok) throw new Error(created.error || "SOURCE_CREATE_FAILED");
  if (await usesLocalStudyData()) {
    const project = getLocalResearchProject(userId, sessionId);
    patchLocalResearchProject(userId, sessionId, {
      sources: [created, ...(project?.sources ?? []).filter((item) => item.id !== created.id)],
    });
  }
  return created;
}

export async function deleteSource(
  userId: string,
  sourceId: string,
): Promise<void> {
  const response = await inkoFetch(`/api/research/sources/${sourceId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("SOURCE_DELETE_FAILED");
}

export async function listFindings(
  userId: string,
  sessionId: string,
): Promise<ResearchFinding[]> {
  if (await usesLocalStudyData()) {
    return getLocalResearchProject(userId, sessionId)?.findings ?? [];
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return getLocalResearchProject(userId, sessionId)?.findings ?? [];

  const { data, error } = await supabase
    .from("research_findings")
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listContradictions(
  userId: string,
  sessionId: string,
): Promise<ResearchContradiction[]> {
  if (await usesLocalStudyData()) {
    return getLocalResearchProject(userId, sessionId)?.contradictions ?? [];
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return getLocalResearchProject(userId, sessionId)?.contradictions ?? [];

  const { data, error } = await supabase
    .from("research_contradictions")
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listOpenQuestions(
  userId: string,
  sessionId: string,
): Promise<OpenQuestion[]> {
  if (await usesLocalStudyData()) {
    return getLocalResearchProject(userId, sessionId)?.openQuestions ?? [];
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return getLocalResearchProject(userId, sessionId)?.openQuestions ?? [];

  const { data, error } = await supabase
    .from("research_open_questions")
    .select("*")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getCanvasNote(
  userId: string,
  sessionId: string,
): Promise<CanvasNote | null> {
  if (await usesLocalStudyData()) {
    return getLocalResearchProject(userId, sessionId)?.canvas ?? null;
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return getLocalResearchProject(userId, sessionId)?.canvas ?? null;

  const { data, error } = await supabase
    .from("research_canvas")
    .select("id, session_id, owner_id, content, updated_at")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertCanvasNote(
  userId: string,
  sessionId: string,
  content: string,
): Promise<void> {
  const local = await usesLocalStudyData();
  if (!local) {
    const response = await inkoFetch(`/api/research/sessions/${sessionId}/canvas`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error("CANVAS_SAVE_FAILED");
  }
  patchLocalResearchProject(userId, sessionId, {
    canvas: {
      id: sessionId,
      session_id: sessionId,
      owner_id: userId,
      content,
      updated_at: new Date().toISOString(),
    },
  });
}

export async function getResearchNote(userId: string, sessionId: string): Promise<ResearchNote | null> {
  if (await usesLocalStudyData()) {
    return getLocalResearchProject(userId, sessionId)?.note ?? null;
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return getLocalResearchProject(userId, sessionId)?.note ?? null;
  const { data, error } = await supabase
    .from("research_notes")
    .select("id, session_id, owner_id, content_markdown, updated_at")
    .eq("owner_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
