import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildProgressSummary, emptyProgressSummary, type FocusMetric, type QuizMetric, type ReviewMetric } from "@/features/progress/progress-summary";
import { buildStudyPlan } from "@/features/study-plan/plan";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!checkRateLimit(`plan:${user.userId}`, 20, 60_000).allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  if (user.isDemo) {
    return NextResponse.json({ error: "DEMO_PLAN_IS_RESOLVED_IN_BROWSER" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const now = new Date().toISOString();
  const [notes, quizzes, dueCardsResult, focusOpen, reviews, attempts, focusHistory] = await Promise.all([
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("owner_id", user.userId),
    supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("owner_id", user.userId),
    supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("owner_id", user.userId).lte("due", now),
    supabase.from("focus_sessions").select("id").eq("owner_id", user.userId).in("status", ["active", "paused"]).limit(1),
    supabase.from("flashcard_reviews").select("id,reviewed_at").eq("owner_id", user.userId),
    supabase.from("quiz_attempts").select("id,created_at,correct").eq("owner_id", user.userId),
    supabase.from("focus_sessions").select("id,completed_at,duration_minutes,status").eq("owner_id", user.userId),
  ]);

  if (notes.error || quizzes.error || dueCardsResult.error || focusOpen.error || reviews.error || attempts.error || focusHistory.error) {
    return NextResponse.json({ error: "PLAN_LOAD_FAILED" }, { status: 502 });
  }

  const summary = buildProgressSummary(
    (reviews.data ?? []) as ReviewMetric[],
    (attempts.data ?? []) as QuizMetric[],
    (focusHistory.data ?? []) as FocusMetric[],
  );

  const plan = buildStudyPlan({
    dueCards: dueCardsResult.count ?? 0,
    notesCount: notes.count ?? 0,
    quizzesCount: quizzes.count ?? 0,
    hasOpenFocus: (focusOpen.data?.length ?? 0) > 0,
    summary: summary ?? emptyProgressSummary,
  });

  return NextResponse.json({ plan, summary });
}
