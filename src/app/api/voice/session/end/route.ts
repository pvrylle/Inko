import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({ voiceSessionId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.isDemo) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data: session, error: loadError } = await supabase
    .from("voice_sessions")
    .select("provider_session_id,status")
    .eq("id", parsed.data.voiceSessionId)
    .eq("owner_id", user.userId)
    .maybeSingle();

  if (loadError) return NextResponse.json({ error: "SESSION_LOAD_FAILED" }, { status: 502 });
  if (!session) return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
  if (session.status === "deleted") return new NextResponse(null, { status: 204 });

  const now = new Date().toISOString();
  const { error: pendingError } = await supabase
    .from("voice_sessions")
    .update({ status: "deletion_pending", ended_at: now, deletion_requested_at: now })
    .eq("id", parsed.data.voiceSessionId)
    .eq("owner_id", user.userId);
  if (pendingError) return NextResponse.json({ error: "SESSION_END_FAILED" }, { status: 502 });

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!session.provider_session_id || !apiKey) return new NextResponse(null, { status: 202 });

  try {
    const deletion = await fetch(`https://agents.assemblyai.com/v1/sessions/${encodeURIComponent(session.provider_session_id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!deletion.ok && deletion.status !== 404) return NextResponse.json({ error: "DELETION_PENDING" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "DELETION_PENDING" }, { status: 202 });
  }

  const { error: deletedError } = await supabase
    .from("voice_sessions")
    .update({ status: "deleted", deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.voiceSessionId)
    .eq("owner_id", user.userId)
    .eq("status", "deletion_pending");
  return deletedError ? NextResponse.json({ error: "DELETION_STATE_FAILED" }, { status: 502 }) : new NextResponse(null, { status: 204 });
}
