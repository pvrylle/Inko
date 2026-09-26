import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { voiceTurnSchema } from "@/lib/voice/session-policy";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (!checkRateLimit(`voice-turn:${user.userId}`, 60, 60_000).allowed) return apiError("RATE_LIMITED", 429);
  const parsed = voiceTurnSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", 400);
  if (user.isDemo) return new Response(null, { status: 204 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data: session, error: loadError } = await supabase
    .from("voice_sessions")
    .select("status")
    .eq("id", parsed.data.voiceSessionId)
    .eq("owner_id", user.userId)
    .maybeSingle();
  if (loadError) return apiError("TURN_SAVE_FAILED", 502);
  if (!session || session.status === "deleted") return apiError("SESSION_NOT_FOUND", 404);

  const { error } = await supabase.from("chat_turns").insert({
    owner_id: user.userId,
    voice_session_id: parsed.data.voiceSessionId,
    role: parsed.data.role,
    transcript: parsed.data.transcript,
    interrupted: parsed.data.interrupted,
  });
  if (error) return apiError("TURN_SAVE_FAILED", 502);
  return new Response(null, { status: 204 });
}
