import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request-user";
import { generateStudyAnswer } from "@/lib/ai/gemini";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { searchStudySources, type StudySource } from "@/lib/research/web-search";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(5000),
  history: z.array(z.object({
    role: z.enum(["student", "inko"]),
    text: z.string().trim().min(1).max(5000),
  })).max(12).optional(),
});

function aiErrorStatus(code: string) {
  return code === "AI_NOT_CONFIGURED" || code === "GEMINI_NOT_CONFIGURED" || code === "OPENAI_NOT_CONFIGURED" ? 503 : 502;
}

function normalizeAiError(code: string) {
  if (code === "GEMINI_NOT_CONFIGURED" || code === "OPENAI_NOT_CONFIGURED") return "AI_NOT_CONFIGURED";
  return code;
}

function studyPrompt(question: string, sources: StudySource[], history: Array<{ role: "student" | "inko"; text: string }>) {
  const context = history.length
    ? `\nRecent conversation (context only):\n${history.map(({ role, text }) => `${role === "student" ? "Student" : "Inko"}: ${text}`).join("\n")}\n`
    : "";
  if (sources.length === 0) {
    return `You are Inko, an AI study companion. Continue the conversation naturally and answer the student's latest message. Ask one concise clarifying question when the topic or requested action is unclear. No sources were found; say so when factual claims need verification. Do not invent citations, paper titles, links, or completed app actions. Keep the answer concise.\n${context}\nLatest student message: ${question}`;
  }
  const block = sources.map((source, index) => `[${index + 1}] ${source.title}\n${source.snippet}`).join("\n\n");
  return `You are Inko, an AI study companion. Continue the conversation naturally. Use the recent conversation for context, but ground factual claims in the sources below. Cite a source inline as [1] or [2]. If sources disagree, say so. If the request is broad or unclear, ask one concise question about scope or preferred sources before a detailed answer. Never claim to have executed an app action unless a tool actually did it. Do not add a link list.\n${context}\nSources:\n${block}\n\nLatest student message: ${question}`;
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

  const history = body.data.history ?? [];
  const previousQuestion = [...history].reverse().find((turn) => turn.role === "student")?.text;
  const searchQuery = body.data.message.length < 35 && previousQuestion
    ? `${previousQuestion} ${body.data.message}`.slice(0, 500)
    : body.data.message;
  const sources = await searchStudySources(searchQuery);
  let text: string;
  try {
    text = await generateStudyAnswer(studyPrompt(body.data.message, sources, history));
  } catch (error) {
    const code = normalizeAiError(error instanceof Error ? error.message : "AI_FAILED");
    return NextResponse.json({ error: code }, { status: aiErrorStatus(code) });
  }

  return NextResponse.json({
    text,
    sources: sources.map(({ title, url }) => ({ title, url })),
  });
}
