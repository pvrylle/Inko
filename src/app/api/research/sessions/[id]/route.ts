import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, mapDbError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });
const patchSchema = z.object({
  question: z.string().trim().min(2).max(500).optional(),
  title: z.string().trim().min(1).max(160).nullable().optional(),
  description: z.string().trim().max(1000).optional(),
}).refine((value) => value.question !== undefined || value.title !== undefined || value.description !== undefined, { message: "EMPTY" });

const columns = "id, owner_id, question, title, description, status, created_at, updated_at";

async function ownedSession(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return { error: apiError("AUTH_REQUIRED", 401) };
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return { error: apiError("INVALID_INPUT", 400) };
  if (user.isDemo) return { error: apiError("SUPABASE_REQUIRED", 503) };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: apiError("SUPABASE_NOT_CONFIGURED", 503) };
  return { user, id: params.data.id, supabase };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await ownedSession(request, context);
  if ("error" in access && access.error) return access.error;
  if (!("supabase" in access)) return apiError("REQUEST_FAILED", 500);
  const { data: session, error } = await access.supabase.from("research_sessions").select(columns).eq("id", access.id).eq("owner_id", access.user.userId).maybeSingle();
  if (error) return apiError("REQUEST_FAILED", 502);
  if (!session) return apiError("NOT_FOUND", 404);
  const [sources, findings, contradictions, questions] = await Promise.all([
    access.supabase.from("research_sources_public").select("id", { count: "exact", head: true }).eq("session_id", access.id),
    access.supabase.from("research_findings").select("id", { count: "exact", head: true }).eq("session_id", access.id),
    access.supabase.from("research_contradictions").select("id", { count: "exact", head: true }).eq("session_id", access.id),
    access.supabase.from("research_open_questions").select("id", { count: "exact", head: true }).eq("session_id", access.id),
  ]);
  return NextResponse.json({
    session,
    counts: {
      sources: sources.count ?? 0,
      findings: findings.count ?? 0,
      contradictions: contradictions.count ?? 0,
      openQuestions: questions.count ?? 0,
    },
  });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await ownedSession(request, context);
  if ("error" in access && access.error) return access.error;
  if (!("supabase" in access)) return apiError("REQUEST_FAILED", 500);
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_INPUT", 400);
  const { data, error } = await access.supabase.from("research_sessions").update(body.data).eq("id", access.id).eq("owner_id", access.user.userId).select(columns).maybeSingle();
  if (error) return apiError(mapDbError(error), 502);
  if (!data) return apiError("NOT_FOUND", 404);
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await ownedSession(request, context);
  if ("error" in access && access.error) return access.error;
  if (!("supabase" in access)) return apiError("REQUEST_FAILED", 500);
  const { error } = await access.supabase.from("research_sessions").delete().eq("id", access.id).eq("owner_id", access.user.userId);
  if (error) return apiError("REQUEST_FAILED", 502);
  return new Response(null, { status: 204 });
}
