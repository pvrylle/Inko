import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, mapDbError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createSchema = z.object({
  question: z.string().trim().min(10).max(500),
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
  const now = new Date().toISOString();
  if (user.isDemo) {
    return NextResponse.json({
      id: crypto.randomUUID(),
      owner_id: user.userId,
      question: body.data.question,
      title: body.data.title ?? null,
      description: body.data.description ?? "",
      status: "draft",
      created_at: now,
      updated_at: now,
    });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data, error } = await supabase.from("research_sessions").insert({
    owner_id: user.userId,
    question: body.data.question,
    title: body.data.title ?? null,
    description: body.data.description ?? "",
  }).select(columns).single();
  if (error || !data) return apiError(mapDbError(error), 502);
  return NextResponse.json(data);
}
