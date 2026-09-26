import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (user.isDemo) return apiError("SUPABASE_REQUIRED", 503);
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_INPUT", 400);

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data: file, error } = await supabase.from("library_files").select("storage_path").eq("id", params.data.id).eq("owner_id", user.userId).maybeSingle();
  if (error) return apiError("REQUEST_FAILED", 502);
  if (!file) return apiError("NOT_FOUND", 404);

  const { data, error: signError } = await supabase.storage.from("library-files").createSignedUrl(file.storage_path, 60);
  if (signError || !data?.signedUrl) return apiError("SIGNED_URL_FAILED", 502);
  return NextResponse.json({ url: data.signedUrl, expiresIn: 60 });
}
