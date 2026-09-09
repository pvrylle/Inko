import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (user.isDemo) return NextResponse.json({ error: "DEMO_REVIEW_IS_RESOLVED_IN_BROWSER" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  const now = new Date().toISOString();
  const [{ data, error }, { count }] = await Promise.all([
    supabase.from("flashcards").select("id,note_id,front,due,reps").eq("owner_id", user.userId).lte("due", now).order("due", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("owner_id", user.userId).lte("due", now),
  ]);
  if (error) return NextResponse.json({ error: "FLASHCARD_LOAD_FAILED" }, { status: 502 });
  return NextResponse.json({ card: data, due_count: count ?? 0 });
}
