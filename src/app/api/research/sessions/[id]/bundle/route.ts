import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { spokenResearchSummary } from "@/lib/research/analysis";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_INPUT", 400);
  if (user.isDemo) return apiError("SUPABASE_REQUIRED", 503);

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const sessionId = params.data.id;
  const { data: session, error } = await supabase.from("research_sessions").select("id, owner_id, question, title, description, status, created_at, updated_at").eq("id", sessionId).eq("owner_id", user.userId).maybeSingle();
  if (error) return apiError("REQUEST_FAILED", 502);
  if (!session) return apiError("NOT_FOUND", 404);

  const [sources, findings, contradictions, openQuestions, canvas, note] = await Promise.all([
    supabase.from("research_sources_public").select("id, session_id, owner_id, title, url, type, tag, library_file_id, meta, created_at").eq("session_id", sessionId).order("created_at", { ascending: true }),
    supabase.from("research_findings").select("id, session_id, owner_id, statement, source_id, created_at").eq("session_id", sessionId).order("created_at", { ascending: true }),
    supabase.from("research_contradictions").select("id, session_id, owner_id, explanation, source_ids, created_at").eq("session_id", sessionId).order("created_at", { ascending: true }),
    supabase.from("research_open_questions").select("id, session_id, owner_id, text, created_at").eq("session_id", sessionId).order("created_at", { ascending: true }),
    supabase.from("research_canvas").select("id, session_id, owner_id, content, updated_at").eq("session_id", sessionId).maybeSingle(),
    supabase.from("research_notes").select("id, session_id, owner_id, content_markdown, updated_at").eq("session_id", sessionId).maybeSingle(),
  ]);

  const summary = spokenResearchSummary({
    question: session.question,
    description: session.description,
    findings: findings.data ?? [],
    contradictions: contradictions.data ?? [],
    openQuestions: openQuestions.data ?? [],
  });

  return NextResponse.json({
    session,
    sources: sources.data ?? [],
    findings: findings.data ?? [],
    contradictions: contradictions.data ?? [],
    openQuestions: openQuestions.data ?? [],
    canvas: canvas.data,
    note: note.data,
    summary,
  });
}
