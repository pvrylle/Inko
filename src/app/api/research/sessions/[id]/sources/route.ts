import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, mapDbError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { assertPublicHttpsUrl } from "@/lib/research/url-guard";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(["document", "url", "file"]).default("document"),
  tag: z.enum(["supports", "contradicts", "untagged"]).default("untagged"),
  url: z.string().trim().max(2000).nullable().optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (!checkRateLimit(`research-source:${user.userId}`, 60, 3_600_000).allowed) return apiError("RATE_LIMITED", 429);
  const params = paramsSchema.safeParse(await context.params);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!params.success || !body.success) return apiError("INVALID_INPUT", 400);
  if (body.data.url) {
    try {
      await assertPublicHttpsUrl(body.data.url);
    } catch (caught) {
      const code = caught instanceof Error && caught.message === "BLOCKED_URL" ? "BLOCKED_URL" : "INVALID_URL";
      return apiError(code, 400);
    }
  }

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    owner_id: user.userId,
    session_id: params.data.id,
    title: body.data.title,
    url: body.data.url ?? null,
    type: body.data.url ? "url" as const : "document" as const,
    tag: body.data.tag,
    library_file_id: null,
    meta: null,
    created_at: now,
  };
  if (user.isDemo) return NextResponse.json(row);

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data: session } = await supabase.from("research_sessions").select("id").eq("id", params.data.id).eq("owner_id", user.userId).maybeSingle();
  if (!session) return apiError("NOT_FOUND", 404);
  const { data, error } = await supabase.from("research_sources").insert({
    owner_id: user.userId,
    session_id: params.data.id,
    title: row.title,
    url: row.url,
    type: row.type,
    tag: row.tag,
  }).select("id, owner_id, session_id, title, url, type, tag, library_file_id, meta, created_at").single();
  if (error || !data) return apiError(mapDbError(error), 502);
  return NextResponse.json(data);
}
