import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ content: z.string().max(50_000) });

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  const params = paramsSchema.safeParse(await context.params);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!params.success || !body.success) return apiError("INVALID_INPUT", 400);
  if (user.isDemo) return new Response(null, { status: 204 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data: session } = await supabase.from("research_sessions").select("id").eq("id", params.data.id).eq("owner_id", user.userId).maybeSingle();
  if (!session) return apiError("NOT_FOUND", 404);
  const { error } = await supabase.from("research_canvas").upsert({
    owner_id: user.userId,
    session_id: params.data.id,
    content: body.data.content,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id,session_id" });
  if (error) return apiError("REQUEST_FAILED", 502);
  return new Response(null, { status: 204 });
}
