import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { providerIdRewrite } from "@/lib/voice/session-policy";

const bodySchema = z.object({
  voiceSessionId: z.string().uuid(),
  providerSessionId: z.string().min(5).max(200),
});

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.isDemo) return apiError("AUTH_REQUIRED", 401);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", 400);

  const decision = providerIdRewrite(null, parsed.data.providerSessionId);
  if (decision === "invalid") return apiError("INVALID_REQUEST", 400);

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data: session, error: loadError } = await supabase
    .from("voice_sessions")
    .select("provider_session_id, status")
    .eq("id", parsed.data.voiceSessionId)
    .eq("owner_id", user.userId)
    .maybeSingle();
  if (loadError) return apiError("SESSION_UPDATE_FAILED", 502);
  if (!session) return apiError("SESSION_NOT_FOUND", 404);
  if (session.status !== "active") return apiError("SESSION_INACTIVE", 409);

  const rewrite = providerIdRewrite(session.provider_session_id, parsed.data.providerSessionId);
  if (rewrite === "invalid") return apiError("INVALID_REQUEST", 400);
  if (rewrite === "conflict") return apiError("PROVIDER_SESSION_CONFLICT", 409);
  if (rewrite === "same") return new Response(null, { status: 204 });

  const { error } = await supabase
    .from("voice_sessions")
    .update({ provider_session_id: parsed.data.providerSessionId })
    .eq("id", parsed.data.voiceSessionId)
    .eq("owner_id", user.userId)
    .eq("status", "active");
  return error ? apiError("SESSION_UPDATE_FAILED", 502) : new Response(null, { status: 204 });
}
