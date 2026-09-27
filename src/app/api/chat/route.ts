import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request-user";
import { generateStudyAnswer } from "@/lib/ai/gemini";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { searchStudySources, type StudySource } from "@/lib/research/web-search";

const bodySchema = z.object({ message: z.string().trim().min(1).max(5000) });

function aiErrorStatus(code: string) {
  return code === "AI_NOT_CONFIGURED" || code === "GEMINI_NOT_CONFIGURED" || code === "OPENAI_NOT_CONFIGURED" ? 503 : 502;
}

function normalizeAiError(code: string) {
  if (code === "GEMINI_NOT_CONFIGURED" || code === "OPENAI_NOT_CONFIGURED") return "AI_NOT_CONFIGURED";
  return code;
}

function studyPrompt(question: string, sources: StudySource[]) {
  if (sources.length === 0) {
    return `You are Inko, a study companion. No sources were found. Answer in 3 or 4 sentences a student can study. Say that you could not attach sources this time. Do not invent citations, paper titles, or links.\n\nStudent: ${question}`;
  }
  const block = sources.map((source, index) => `[${index + 1}] ${source.title}\n${source.snippet}`).join("\n\n");
  return `You are Inko, a study companion. Answer like a research notebook: use only the source snippets below. Write 4 to 6 sentences a student can study. Cite snippets inline as [1] or [2]. If the snippets disagree, say so. If they do not cover the question, say what is missing instead of guessing. Do not add a link list.\n\nSources:\n${block}\n\nStudent: ${question}`;
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

  const sources = await searchStudySources(body.data.message);
  let text: string;
  try {
    text = await generateStudyAnswer(studyPrompt(body.data.message, sources));
  } catch (error) {
    const code = normalizeAiError(error instanceof Error ? error.message : "AI_FAILED");
    return NextResponse.json({ error: code }, { status: aiErrorStatus(code) });
  }

  return NextResponse.json({
    text,
    sources: sources.map(({ title, url }) => ({ title, url })),
  });
}
