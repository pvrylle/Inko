import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, mapDbError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { generateQuestionBrief, materializeBrief } from "@/lib/research/question-brief";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createSchema = z.object({
  question: z.string().trim().min(2).max(500),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
});

const columns = "id, owner_id, question, title, description, status, created_at, updated_at";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (user.isDemo) return NextResponse.json({ sessions: [] });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data, error } = await supabase.from("research_sessions").select(columns).eq("owner_id", user.userId).order("updated_at", { ascending: false });
  if (error) return apiError("REQUEST_FAILED", 502);
  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (!checkRateLimit(`research-session:${user.userId}`, 20, 3_600_000).allowed) return apiError("RATE_LIMITED", 429);
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_INPUT", 400);

  const brief = await generateQuestionBrief(body.data.question);
  const bundle = materializeBrief(user.userId, body.data.question, brief);

  if (user.isDemo) return NextResponse.json(bundle);

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ ...bundle, persisted: false });
  const { data, error } = await supabase.from("research_sessions").insert({
    id: bundle.session.id,
    owner_id: user.userId,
    question: body.data.question,
    title: body.data.title ?? brief.title,
    description: body.data.description ?? brief.description,
    status: "ready",
  }).select(columns).single();
  if (error || !data) return NextResponse.json({ ...bundle, persisted: false });

  await Promise.all([
    supabase.from("research_sources").insert(
      bundle.sources.map(({ id, session_id, owner_id, title, url, type, tag, meta }) => ({
        id, session_id, owner_id, title, url, type, tag, meta,
      })),
    ),
    supabase.from("research_findings").insert(bundle.findings.map(({ id, session_id, owner_id, statement, source_id }) => ({
      id, session_id, owner_id, statement, source_id,
    }))),
    bundle.contradictions.length
      ? supabase.from("research_contradictions").insert(bundle.contradictions.map(({ id, session_id, owner_id, explanation, source_ids }) => ({
        id, session_id, owner_id, explanation, source_ids,
      })))
      : Promise.resolve(),
    supabase.from("research_open_questions").insert(bundle.openQuestions.map(({ id, session_id, owner_id, text }) => ({
      id, session_id, owner_id, text,
    }))),
    supabase.from("research_notes").upsert({
      id: bundle.note.id,
      session_id: data.id,
      owner_id: user.userId,
      content_markdown: bundle.note.content_markdown,
    }),
  ]);

  return NextResponse.json({ ...bundle, session: { ...data, title: brief.title, description: brief.description, status: "ready" } });
}
