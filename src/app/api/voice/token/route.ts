import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteAssemblySession } from "@/lib/voice/provider-delete";

const TOKEN_TTL_SECONDS = 90;
const MAX_SESSION_SECONDS = 1800;

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (user.isDemo) return apiError("SUPABASE_REQUIRED", 503);
  if (!checkRateLimit(`voice-token:${user.userId}`, 8, 60_000).allowed) return apiError("RATE_LIMITED", 429);

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  const agentId = process.env.ASSEMBLYAI_AGENT_ID;
  if (!apiKey || !agentId) return apiError("VOICE_NOT_CONFIGURED", 503);

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);

  const { data: activeRows, error: activeError } = await supabase
    .from("voice_sessions")
    .select("id, provider_session_id")
    .eq("owner_id", user.userId)
    .eq("status", "active");
  if (activeError) return apiError("SESSION_CREATE_FAILED", 500);

  const now = new Date().toISOString();
  for (const existing of activeRows ?? []) {
    await supabase.from("voice_sessions").update({
      status: "deletion_pending",
      ended_at: now,
      deletion_requested_at: now,
    }).eq("id", existing.id).eq("owner_id", user.userId).eq("status", "active");
    if (!existing.provider_session_id) {
      await supabase.from("voice_sessions").update({ status: "failed", ended_at: now }).eq("id", existing.id).eq("owner_id", user.userId);
      continue;
    }
    const deleted = await deleteAssemblySession(existing.provider_session_id);
    if (deleted === "deleted") {
      await supabase.from("voice_sessions").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", existing.id).eq("owner_id", user.userId);
    }
  }

  const { data: session, error: sessionError } = await supabase
    .from("voice_sessions")
    .insert({ owner_id: user.userId, status: "active" })
    .select("id")
    .single();
  if (sessionError || !session) return apiError("SESSION_CREATE_FAILED", 500);

  const params = new URLSearchParams({
    expires_in_seconds: String(TOKEN_TTL_SECONDS),
    max_session_duration_seconds: String(MAX_SESSION_SECONDS),
  });
  const response = await fetch(`https://agents.assemblyai.com/v1/token?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!response.ok) {
    await supabase.from("voice_sessions").update({ status: "failed", ended_at: new Date().toISOString() }).eq("id", session.id);
    return apiError("VOICE_TOKEN_FAILED", 502);
  }

  const payload = (await response.json()) as { token?: string; expires_in_seconds?: number };
  if (!payload.token) {
    await supabase.from("voice_sessions").update({ status: "failed", ended_at: new Date().toISOString() }).eq("id", session.id);
    return apiError("VOICE_TOKEN_FAILED", 502);
  }
  return NextResponse.json({
    token: payload.token,
    expires_in_seconds: payload.expires_in_seconds ?? TOKEN_TTL_SECONDS,
    agentId,
    voiceSessionId: session.id,
    maxSessionDurationSeconds: MAX_SESSION_SECONDS,
  });
}
