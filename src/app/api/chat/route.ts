import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request-user";
import { generateGeminiText } from "@/lib/ai/gemini";
import { checkRateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({ message: z.string().trim().min(1).max(5000) });

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!checkRateLimit(`chat:${user.userId}`, 20, 60_000).allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });

  try {
    const text = await generateGeminiText(`You are Inko, a warm, playful study buddy. Reply in no more than three short sentences. Never claim to save or create an artifact unless a tool did it.\n\nStudent: ${body.data.message}`);
    return NextResponse.json({ text });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AI_FAILED";
    return NextResponse.json({ error: code }, { status: code === "GEMINI_NOT_CONFIGURED" ? 503 : 502 });
  }
}
