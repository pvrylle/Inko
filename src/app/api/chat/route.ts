import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request-user";
import { generateText } from "@/lib/ai/generate";
import { checkRateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({ message: z.string().trim().min(1).max(5000) });

function aiErrorStatus(code: string) {
  return code === "AI_NOT_CONFIGURED" || code === "GEMINI_NOT_CONFIGURED" || code === "OPENAI_NOT_CONFIGURED" ? 503 : 502;
}

function normalizeAiError(code: string) {
  if (code === "GEMINI_NOT_CONFIGURED" || code === "OPENAI_NOT_CONFIGURED") return "AI_NOT_CONFIGURED";
  return code;
}

function guestAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && forwarded.length <= 64 ? forwarded : "local";
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  const guest = !user || user.isDemo;
  const limitKey = user && !user.isDemo ? `chat:${user.userId}` : `chat:guest:${guestAddress(request)}`;
  if (!checkRateLimit(limitKey, guest ? 10 : 20, guest ? 86_400_000 : 60_000).allowed) {
    return NextResponse.json({ error: guest ? "GUEST_LIMIT" : "RATE_LIMITED" }, { status: 429 });
  }
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });

  try {
    const text = await generateText(`You are Inko, a warm, playful study buddy. Reply in no more than three short sentences. Never claim to save or create an artifact unless a tool did it.\n\nStudent: ${body.data.message}`);
    return NextResponse.json({ text });
  } catch (error) {
    const code = normalizeAiError(error instanceof Error ? error.message : "AI_FAILED");
    return NextResponse.json({ error: code }, { status: aiErrorStatus(code) });
  }
}
