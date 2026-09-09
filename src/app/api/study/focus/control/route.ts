import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { focusControlActionSchema, focusSessionSchema } from "@/features/focus/focus-schema";
import { transitionFocusSession } from "@/features/focus/focus-timer";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  action: focusControlActionSchema,
  current_session: focusSessionSchema.optional(),
  callId: z.string().min(6).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!checkRateLimit(`focus-control:${user.userId}`, 60, 60_000).allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "INVALID_FOCUS_ACTION" }, { status: 400 });

  if (!user.isDemo) {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
    const { data, error } = await supabase.rpc("control_focus_timer", { p_action: body.data.action, p_call_id: body.data.callId ?? crypto.randomUUID() });
    if (error || !data) return NextResponse.json({ error: "FOCUS_CONTROL_FAILED" }, { status: 502 });
    return NextResponse.json(data);
  }

  const current = body.data.current_session?.owner_id === user.userId ? body.data.current_session : null;
  const now = new Date();
  const result = transitionFocusSession(current, body.data.action, now);
  return NextResponse.json({ ...result, persisted: false, server_now: now.toISOString() });
}
