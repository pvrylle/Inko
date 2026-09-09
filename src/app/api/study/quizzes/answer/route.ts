import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeQuizAnswer } from "@/features/quizzes/quiz-schema";
import { getRequestUser } from "@/lib/auth/request-user";
import type { QuizAnswerKey, QuizAttempt, QuizQuestion } from "@/lib/data/models";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const demoQuestionSchema = z.object({
  id: z.string().uuid(), quiz_id: z.string().uuid(), owner_id: z.string().uuid(), position: z.number().int().nonnegative(),
  prompt: z.string().min(1).max(2_000), options: z.array(z.string().min(1).max(500)).length(4), created_at: z.string().datetime(),
});
const demoKeySchema = z.object({ id: z.string().uuid(), question_id: z.string().uuid(), owner_id: z.string().uuid(), correct_index: z.number().int().min(0).max(3), explanation: z.string().min(1).max(1_500) });
const demoAttemptSchema = z.object({
  id: z.string().uuid(), owner_id: z.string().uuid(), quiz_id: z.string().uuid(), question_id: z.string().uuid(),
  selected_index: z.number().int().min(0).max(3), correct: z.boolean(), feedback: z.string(), created_at: z.string().datetime(),
});
const requestSchema = z.object({
  question_id: z.string().uuid(),
  selected_index: z.number().int().min(0).max(3).optional(),
  answer: z.string().trim().min(1).max(1_000).optional(),
  question: demoQuestionSchema.optional(),
  answer_key: demoKeySchema.optional(),
  existing_attempt: demoAttemptSchema.optional(),
}).refine((value) => value.selected_index !== undefined || value.answer !== undefined, { message: "An answer is required." });

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!checkRateLimit(`quiz-answer:${user.userId}`, 60, 60_000).allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "INVALID_QUIZ_ANSWER" }, { status: 400 });
  const supabase = user.isDemo ? null : await createServerSupabaseClient();

  let question: QuizQuestion | null = null;
  if (supabase) {
    const { data } = await supabase.from("quiz_questions").select("*").eq("id", body.data.question_id).eq("owner_id", user.userId).maybeSingle();
    question = data as QuizQuestion | null;
  } else if (body.data.question?.id === body.data.question_id && body.data.question.owner_id === user.userId) {
    question = body.data.question;
  }
  if (!question) return NextResponse.json({ error: "QUIZ_QUESTION_NOT_FOUND" }, { status: 404 });

  const selectedIndex = normalizeQuizAnswer(body.data.selected_index ?? body.data.answer ?? "", question.options);
  if (selectedIndex === null) return NextResponse.json({ error: "QUIZ_ANSWER_NOT_RECOGNIZED" }, { status: 400 });

  if (supabase) {
    const { data, error } = await supabase.rpc("submit_quiz_answer", { p_question_id: question.id, p_selected_index: selectedIndex });
    if (error || !data) return NextResponse.json({ error: "QUIZ_ANSWER_SAVE_FAILED" }, { status: 502 });
    return NextResponse.json(data);
  }

  const key = body.data.answer_key as QuizAnswerKey | undefined;
  if (!key || key.question_id !== question.id || key.owner_id !== user.userId) return NextResponse.json({ error: "QUIZ_ANSWER_KEY_NOT_FOUND" }, { status: 404 });
  const existing = body.data.existing_attempt as QuizAttempt | undefined;
  const attempt: QuizAttempt = existing?.question_id === question.id && existing.owner_id === user.userId ? existing : {
    id: crypto.randomUUID(), owner_id: user.userId, quiz_id: question.quiz_id, question_id: question.id, selected_index: selectedIndex,
    correct: selectedIndex === key.correct_index,
    feedback: `${selectedIndex === key.correct_index ? "Correct." : "Not quite."} ${key.explanation}`,
    created_at: new Date().toISOString(),
  };
  return NextResponse.json({ attempt, correct_index: key.correct_index, persisted: false });
}
