import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503, headers: noStore });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: noStore });

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  const admin = createAdminSupabaseClient();
  if (!apiKey || !admin) return NextResponse.json({ error: "CLEANUP_NOT_CONFIGURED" }, { status: 503, headers: noStore });

  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - 35 * 60_000).toISOString();
  const { error: staleError } = await admin
    .from("voice_sessions")
    .update({ status: "deletion_pending", ended_at: nowIso, deletion_requested_at: nowIso })
    .eq("status", "active")
    .lt("started_at", staleBefore);
  if (staleError) return NextResponse.json({ error: "STALE_SESSION_RECOVERY_FAILED" }, { status: 502, headers: noStore });

  const { data: pending, error: loadError } = await admin
    .from("voice_sessions")
    .select("id,provider_session_id")
    .eq("status", "deletion_pending")
    .order("deletion_requested_at", { ascending: true, nullsFirst: true })
    .limit(25);
  if (loadError) return NextResponse.json({ error: "CLEANUP_LOAD_FAILED" }, { status: 502, headers: noStore });

  let deleted = 0;
  let retryable = 0;
  let missingProviderId = 0;
  for (const session of pending ?? []) {
    if (!session.provider_session_id) {
      missingProviderId += 1;
      continue;
    }
    try {
      const response = await fetch(`https://agents.assemblyai.com/v1/sessions/${encodeURIComponent(session.provider_session_id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok && response.status !== 404) {
        retryable += 1;
        continue;
      }
      const { error } = await admin
        .from("voice_sessions")
        .update({ status: "deleted", deleted_at: new Date().toISOString() })
        .eq("id", session.id)
        .eq("status", "deletion_pending");
      if (error) retryable += 1;
      else deleted += 1;
    } catch {
      retryable += 1;
    }
  }

  return NextResponse.json({ claimed: pending?.length ?? 0, deleted, retryable, missing_provider_id: missingProviderId }, { headers: noStore });
}
