import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { focusSessionSchema } from "@/features/focus/focus-schema";
import { createFocusSession, reconcileFocusSession } from "@/features/focus/focus-timer";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  minutes: z.number().int().min(1).max(180),
  current_session: focusSessionSchema.optional(),
  callId: z.string().min(6).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!checkRateLimit(`focus-start:${user.userId}`, 15, 60_000).allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "INVALID_FOCUS_DURATION" }, { status: 400 });

  if (!user.isDemo) {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
    const { data, error } = await supabase.rpc("start_focus_session", { p_call_id: body.data.callId ?? crypto.randomUUID(), p_duration_minutes: body.data.minutes });
    if (error || !data) return NextResponse.json({ error: "FOCUS_START_FAILED" }, { status: 502 });
    return NextResponse.json(data);
  }

  const now = new Date();
  const current = body.data.current_session?.owner_id === user.userId ? body.data.current_session : null;
  if (current?.status === "active" || current?.status === "paused") {
    const reconciled = reconcileFocusSession(current, now);
    if (!reconciled.changed) return NextResponse.json({ session: current, transition: "already_open", persisted: false, server_now: now.toISOString() });
    const session = createFocusSession(user.userId, body.data.minutes, now);
    return NextResponse.json({ session, previous_session: reconciled.session, transition: "started", persisted: false, server_now: now.toISOString() });
  }
  return NextResponse.json({ session: createFocusSession(user.userId, body.data.minutes, now), transition: "started", persisted: false, server_now: now.toISOString() });
}
