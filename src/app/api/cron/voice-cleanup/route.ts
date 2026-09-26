import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/http";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { deleteAssemblySession } from "@/lib/voice/provider-delete";
import { staleVoiceAction } from "@/lib/voice/session-policy";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return apiError("AUTH_REQUIRED", 401);

  const admin = createAdminSupabaseClient();
  if (!admin) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data, error } = await admin
    .from("voice_sessions")
    .select("id, status, started_at, provider_session_id")
    .in("status", ["active", "deletion_pending"])
    .limit(100);
  if (error) return apiError("CLEANUP_FAILED", 502);

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  for (const session of data ?? []) {
    const action = staleVoiceAction({
      status: session.status,
      startedAt: session.started_at,
      providerSessionId: session.provider_session_id,
      now,
    });
    if (action === "none") continue;
    if (action === "fail_unbound") {
      await admin.from("voice_sessions").update({ status: "failed", ended_at: nowIso }).eq("id", session.id).eq("status", "active");
      continue;
    }
    await admin.from("voice_sessions").update({
      status: "deletion_pending",
      ended_at: nowIso,
      deletion_requested_at: nowIso,
    }).eq("id", session.id).eq("status", "active");
    if (!session.provider_session_id) continue;
    const deleted = await deleteAssemblySession(session.provider_session_id);
    if (deleted === "deleted") {
      await admin.from("voice_sessions").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", session.id).eq("status", "deletion_pending");
    }
  }

  return NextResponse.json({ ok: true });
}
