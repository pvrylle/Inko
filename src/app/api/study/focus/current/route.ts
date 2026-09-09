import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (user.isDemo) return NextResponse.json({ session: null, persisted: false, server_now: new Date().toISOString() });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const { data, error } = await supabase.rpc("get_current_focus_session");
  if (error || !data) return NextResponse.json({ error: "FOCUS_SYNC_FAILED" }, { status: 502 });
  return NextResponse.json(data);
}
