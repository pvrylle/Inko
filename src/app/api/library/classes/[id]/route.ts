import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_INPUT", 400);
  if (user.isDemo) return new Response(null, { status: 204 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const cascade = request.nextUrl.searchParams.get("cascade") === "1";
  const { data: files, error: listError } = await supabase.from("library_files").select("id, storage_path").eq("owner_id", user.userId).eq("class_id", params.data.id);
  if (listError) return apiError("REQUEST_FAILED", 502);
  if ((files?.length ?? 0) > 0 && !cascade) return apiError("CLASS_NOT_EMPTY", 409);
  if (files && files.length > 0) {
    const { error: storageError } = await supabase.storage.from("library-files").remove(files.map((file) => file.storage_path));
    if (storageError) return apiError("STORAGE_DELETE_FAILED", 502);
  }
  const { error } = await supabase.from("library_classes").delete().eq("id", params.data.id).eq("owner_id", user.userId);
  if (error) return apiError("REQUEST_FAILED", 502);
  return new Response(null, { status: 204 });
}
