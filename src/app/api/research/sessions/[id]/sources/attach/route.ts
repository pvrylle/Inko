import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, mapDbError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  libraryFileId: z.string().uuid(),
  tag: z.enum(["supports", "contradicts", "untagged"]).default("untagged"),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (user.isDemo) return apiError("SUPABASE_REQUIRED", 503);
  const params = paramsSchema.safeParse(await context.params);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!params.success || !body.success) return apiError("INVALID_INPUT", 400);

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const [{ data: session }, { data: file }] = await Promise.all([
    supabase.from("research_sessions").select("id").eq("id", params.data.id).eq("owner_id", user.userId).maybeSingle(),
    supabase.from("library_files").select("id, name, type").eq("id", body.data.libraryFileId).eq("owner_id", user.userId).maybeSingle(),
  ]);
  if (!session || !file) return apiError("NOT_FOUND", 404);

  const { data, error } = await supabase.from("research_sources").insert({
    owner_id: user.userId,
    session_id: params.data.id,
    title: file.name,
    url: null,
    type: "file",
    tag: body.data.tag,
    library_file_id: file.id,
    meta: file.type.toUpperCase(),
  }).select("id, owner_id, session_id, title, url, type, tag, library_file_id, meta, created_at").single();
  if (error || !data) {
    const code = mapDbError(error);
    return apiError(code, code === "SOURCE_ALREADY_ATTACHED" ? 409 : 502);
  }
  return NextResponse.json(data);
}
