import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });
const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  tag: z.enum(["supports", "contradicts", "untagged"]).optional(),
}).refine((value) => value.title !== undefined || value.tag !== undefined);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  const params = paramsSchema.safeParse(await context.params);
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!params.success || !body.success) return apiError("INVALID_INPUT", 400);
  if (user.isDemo) return NextResponse.json({ id: params.data.id, ...body.data });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data, error } = await supabase.from("research_sources").update(body.data).eq("id", params.data.id).eq("owner_id", user.userId).select("id, owner_id, session_id, title, url, type, tag, library_file_id, meta, created_at").maybeSingle();
  if (error) return apiError("REQUEST_FAILED", 502);
  if (!data) return apiError("NOT_FOUND", 404);
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_INPUT", 400);
  if (user.isDemo) return new Response(null, { status: 204 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { error } = await supabase.from("research_sources").delete().eq("id", params.data.id).eq("owner_id", user.userId);
  if (error) return apiError("REQUEST_FAILED", 502);
  return new Response(null, { status: 204 });
}
