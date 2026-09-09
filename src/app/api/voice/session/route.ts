import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({ voiceSessionId: z.string().uuid(), providerSessionId: z.string().min(5).max(200) });

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.isDemo) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { error } = await supabase
    .from("voice_sessions")
    .update({ provider_session_id: parsed.data.providerSessionId })
    .eq("id", parsed.data.voiceSessionId)
    .eq("owner_id", user.userId);

  return error ? NextResponse.json({ error: "SESSION_UPDATE_FAILED" }, { status: 502 }) : new NextResponse(null, { status: 204 });
}
