import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, mapDbError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (user.isDemo) return NextResponse.json({ classes: [] });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data, error } = await supabase.from("library_classes").select("id, owner_id, name, created_at").eq("owner_id", user.userId).order("created_at", { ascending: true });
  if (error) return apiError("REQUEST_FAILED", 502);
  return NextResponse.json({ classes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (!checkRateLimit(`library-class:${user.userId}`, 30, 3_600_000).allowed) return apiError("RATE_LIMITED", 429);
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_INPUT", 400);
  if (user.isDemo) {
    return NextResponse.json({
      id: crypto.randomUUID(),
      owner_id: user.userId,
      name: body.data.name,
      created_at: new Date().toISOString(),
    });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data, error } = await supabase.from("library_classes").insert({ owner_id: user.userId, name: body.data.name }).select("id, owner_id, name, created_at").single();
  if (error || !data) return apiError(mapDbError(error), error?.code === "23505" ? 409 : 502);
  return NextResponse.json(data);
}
