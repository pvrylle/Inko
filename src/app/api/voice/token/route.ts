import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const TOKEN_TTL_SECONDS = 90;
const MAX_SESSION_SECONDS = 1800;

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (user.isDemo) return NextResponse.json({ error: "SUPABASE_REQUIRED", message: "Connect Supabase to start private voice sessions." }, { status: 503 });

  const rate = checkRateLimit(`voice-token:${user.userId}`, 8, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  const agentId = process.env.ASSEMBLYAI_AGENT_ID;
  if (!apiKey || !agentId) return NextResponse.json({ error: "VOICE_NOT_CONFIGURED" }, { status: 503 });

  const supabase = await createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase!
    .from("voice_sessions")
    .insert({ owner_id: user.userId, status: "active" })
    .select("id")
    .single();

  if (sessionError || !session) return NextResponse.json({ error: "SESSION_CREATE_FAILED" }, { status: 500 });

  const params = new URLSearchParams({
    expires_in_seconds: String(TOKEN_TTL_SECONDS),
    max_session_duration_seconds: String(MAX_SESSION_SECONDS),
  });
  const response = await fetch(`https://agents.assemblyai.com/v1/token?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!response.ok) {
    await supabase!.from("voice_sessions").update({ status: "failed", ended_at: new Date().toISOString() }).eq("id", session.id);
    return NextResponse.json({ error: "VOICE_TOKEN_FAILED" }, { status: response.status });
  }

  const payload = (await response.json()) as { token: string; expires_in_seconds: number };
  return NextResponse.json({ ...payload, agentId, voiceSessionId: session.id, maxSessionDurationSeconds: MAX_SESSION_SECONDS });
}
