import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteAssemblySession } from "@/lib/voice/provider-delete";

const bodySchema = z.object({ voiceSessionId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.isDemo) return apiError("AUTH_REQUIRED", 401);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", 400);

  const supabase = await createServerSupabaseClient();
  if (!supabase) return apiError("SUPABASE_NOT_CONFIGURED", 503);
  const { data: session, error: loadError } = await supabase
    .from("voice_sessions")
    .select("provider_session_id, status")
    .eq("id", parsed.data.voiceSessionId)
    .eq("owner_id", user.userId)
    .maybeSingle();
  if (loadError) return apiError("SESSION_LOAD_FAILED", 502);
  if (!session) return apiError("SESSION_NOT_FOUND", 404);
  if (session.status === "deleted") return new Response(null, { status: 204 });

  const now = new Date().toISOString();
  if (session.status !== "deletion_pending") {
    const { error: pendingError } = await supabase
      .from("voice_sessions")
      .update({ status: "deletion_pending", ended_at: now, deletion_requested_at: now })
      .eq("id", parsed.data.voiceSessionId)
      .eq("owner_id", user.userId);
    if (pendingError) return apiError("SESSION_END_FAILED", 502);
  }

  if (!session.provider_session_id) return new Response(null, { status: 202 });
  const deleted = await deleteAssemblySession(session.provider_session_id);
  if (deleted !== "deleted") return apiError("DELETION_PENDING", 202);

  const { error: deletedError } = await supabase
    .from("voice_sessions")
    .update({ status: "deleted", deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.voiceSessionId)
    .eq("owner_id", user.userId)
    .eq("status", "deletion_pending");
  return deletedError ? apiError("DELETION_STATE_FAILED", 502) : new Response(null, { status: 204 });
}
