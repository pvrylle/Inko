import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, mapDbError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { assertUpload, MAX_FILES_PER_CLASS, MAX_FILES_PER_OWNER } from "@/lib/library/file-guard";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const classSchema = z.string().uuid();

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (user.isDemo) return NextResponse.json({ files: [] });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data, error } = await supabase
    .from("library_files")
    .select("id, owner_id, class_id, name, type, size_bytes, storage_path, upload_date, created_at")
    .eq("owner_id", user.userId)
    .order("upload_date", { ascending: false });
  if (error) return apiError("REQUEST_FAILED", 502);
  return NextResponse.json({ files: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (user.isDemo) return apiError("SUPABASE_REQUIRED", 503);
  if (!checkRateLimit(`library-upload:${user.userId}`, 30, 3_600_000).allowed) return apiError("RATE_LIMITED", 429);

  const form = await request.formData().catch(() => null);
  const classId = classSchema.safeParse(form?.get("classId"));
  const file = form?.get("file");
  if (!classId.success || !(file instanceof File)) return apiError("INVALID_INPUT", 400);

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const checked = assertUpload({ name: file.name, type: file.type, size: file.size }, header);
  if (!checked.ok) return apiError(checked.error, 400);

  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();
  if (!supabase || !admin) return apiError("SUPABASE_NOT_CONFIGURED", 503);

  const { data: libraryClass, error: classError } = await supabase.from("library_classes").select("id").eq("id", classId.data).eq("owner_id", user.userId).maybeSingle();
  if (classError) return apiError("REQUEST_FAILED", 502);
  if (!libraryClass) return apiError("CLASS_NOT_FOUND", 404);

  const [{ count: classCount }, { count: ownerCount }] = await Promise.all([
    supabase.from("library_files").select("id", { count: "exact", head: true }).eq("class_id", classId.data).eq("owner_id", user.userId),
    supabase.from("library_files").select("id", { count: "exact", head: true }).eq("owner_id", user.userId),
  ]);
  if ((classCount ?? 0) >= MAX_FILES_PER_CLASS) return apiError("CLASS_FILE_QUOTA", 409);
  if ((ownerCount ?? 0) >= MAX_FILES_PER_OWNER) return apiError("OWNER_FILE_QUOTA", 409);

  const fileId = crypto.randomUUID();
  const storagePath = `${user.userId}/${classId.data}/${fileId}/${checked.name}`;
  const { error: uploadError } = await admin.storage.from("library-files").upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) return apiError("UPLOAD_FAILED", 502);

  const now = new Date().toISOString();
  const { data, error } = await supabase.from("library_files").insert({
    id: fileId,
    owner_id: user.userId,
    class_id: classId.data,
    name: checked.name,
    type: checked.type,
    size_bytes: file.size,
    storage_path: storagePath,
    upload_date: now,
  }).select("id, owner_id, class_id, name, type, size_bytes, storage_path, upload_date, created_at").single();

  if (error || !data) {
    await admin.storage.from("library-files").remove([storagePath]);
    return apiError(mapDbError(error), 502);
  }
  return NextResponse.json(data);
}
