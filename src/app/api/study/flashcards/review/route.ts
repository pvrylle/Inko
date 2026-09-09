import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scheduleFlashcard } from "@/features/flashcards/fsrs";
import { getRequestUser } from "@/lib/auth/request-user";
import type { Flashcard, FlashcardReview } from "@/lib/data/models";
import { checkRateLimit } from "@/lib/security/rate-limit";
import type { Json } from "@/lib/supabase/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const demoCardSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  note_id: z.string().uuid(),
  front: z.string().min(1).max(1_000),
  back: z.string().min(1).max(4_000),
  explanation: z.string().max(2_000).nullable(),
  due: z.string().datetime(),
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsed_days: z.number().int().nonnegative(),
  scheduled_days: z.number().int().nonnegative(),
  learning_steps: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: z.number().int().min(0).max(3),
  last_review: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const requestSchema = z.object({
  card_id: z.string().uuid(),
  card: demoCardSchema.optional(),
  rating: z.enum(["again", "hard", "good", "easy"]),
  answer: z.string().trim().max(4_000).optional(),
  semantic_score: z.number().min(0).max(1).optional(),
  feedback: z.string().trim().max(600).optional(),
  callId: z.string().min(6).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!checkRateLimit(`flashcard-review:${user.userId}`, 60, 60_000).allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "INVALID_FLASHCARD_REVIEW" }, { status: 400 });

  const supabase = user.isDemo ? null : await createServerSupabaseClient();
  if (supabase && body.data.callId) {
    const { data: previous } = await supabase.from("tool_executions").select("result").eq("call_id", body.data.callId).eq("tool_name", "commit_flashcard_rating").maybeSingle();
    if (previous?.result) return NextResponse.json(previous.result);
  }

  try {
    let card: Flashcard | null = null;
    if (supabase) {
      const { data } = await supabase.from("flashcards").select("*").eq("id", body.data.card_id).eq("owner_id", user.userId).maybeSingle();
      card = data as Flashcard | null;
    } else if (body.data.card?.id === body.data.card_id && body.data.card.owner_id === user.userId) {
      card = body.data.card;
    }
    if (!card) return NextResponse.json({ error: "FLASHCARD_NOT_FOUND" }, { status: 404 });

    const reviewedAt = new Date();
    const reviewedAtIso = reviewedAt.toISOString();
    const nextFsrs = scheduleFlashcard(card, body.data.rating, reviewedAt);
    const reviewId = crypto.randomUUID();
    let updatedCard: Flashcard = { ...card, ...nextFsrs, updated_at: reviewedAtIso };
    const review: FlashcardReview = {
      id: reviewId,
      owner_id: user.userId,
      flashcard_id: card.id,
      rating: body.data.rating,
      answer_text: body.data.answer || null,
      semantic_score: body.data.semantic_score ?? null,
      feedback: body.data.feedback || null,
      previous_due: card.due,
      next_due: nextFsrs.due,
      reviewed_at: reviewedAtIso,
    };

    let persisted = false;
    if (supabase) {
      const { data: saved, error } = await supabase.rpc("commit_flashcard_review", {
        p_answer_text: review.answer_text,
        p_card_id: card.id,
        p_difficulty: nextFsrs.difficulty,
        p_due: nextFsrs.due,
        p_elapsed_days: nextFsrs.elapsed_days,
        p_feedback: review.feedback,
        p_lapses: nextFsrs.lapses,
        p_last_review: nextFsrs.last_review,
        p_learning_steps: nextFsrs.learning_steps,
        p_rating: body.data.rating,
        p_reps: nextFsrs.reps,
        p_review_id: reviewId,
        p_reviewed_at: reviewedAtIso,
        p_scheduled_days: nextFsrs.scheduled_days,
        p_semantic_score: review.semantic_score,
        p_stability: nextFsrs.stability,
        p_state: nextFsrs.state,
      }).single();
      if (error || !saved) throw new Error("FLASHCARD_REVIEW_COMMIT_FAILED");
      updatedCard = saved as Flashcard;
      persisted = true;
    }

    const result = { card: updatedCard, review, persisted };
    if (supabase && body.data.callId) {
      await supabase.from("tool_executions").insert({ owner_id: user.userId, call_id: body.data.callId, tool_name: "commit_flashcard_rating", result: result as unknown as Json });
    }
    return NextResponse.json(result);
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "FLASHCARD_REVIEW_FAILED";
    return NextResponse.json({ error }, { status: 502 });
  }
}
