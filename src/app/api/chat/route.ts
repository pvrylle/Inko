import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request-user";
import { chatSourceTrailer } from "@/lib/ai/chat-stream";
import { generateFastGeminiTextStream } from "@/lib/ai/gemini";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { searchStudySources, type StudySource } from "@/lib/research/web-search";

const pageSchema = z.object({
  kind: z.enum(["debate", "research", "quiz", "flashcards", "focus"]),
  label: z.string().max(200),
  detail: z.string().max(2000),
}).optional();

const bodySchema = z.object({
  message: z.string().trim().min(1).max(5000),
  history: z.array(z.object({
    role: z.enum(["student", "inko"]),
    text: z.string().trim().min(1).max(5000),
  })).max(12).optional(),
  page: pageSchema,
});

type PageContext = z.infer<typeof pageSchema>;

function studyPrompt(question: string, sources: StudySource[], history: Array<{ role: "student" | "inko"; text: string }>, page?: PageContext) {
  const context = history.length
    ? `\nRecent conversation (context only):\n${history.map(({ role, text }) => `${role === "student" ? "Student" : "Inko"}: ${text}`).join("\n")}\n`
    : "";
  const pageBlock = page
    ? `\n[Student's current page — use for context only, do not repeat verbatim]\n${page.label}\n${page.detail}\n`
    : "";
  const teaching = `You are Inko, a patient study tutor. Answer like a teacher explaining the idea to a student, not like a search snippet.

- Open with the answer in plain language.
- Explain why it is true, and define any term a student might not know.
- Give one concrete example.
- Close with one line on what to remember.
- Write two to four short paragraphs, separated by a blank line. Use a short bullet list only when the student asks for steps.
- Do not wrap words in asterisks or other markup.
- If the question is unclear, ask one question and still give the most useful explanation you can.
- Do not invent citations, paper titles, links, or claim that an app action already happened.`;
  if (sources.length === 0) {
    return `${teaching} No sources were found. Teach from well-established knowledge, and say so when a claim still needs a source.${pageBlock}\n${context}\nLatest student message: ${question}`;
  }
  const block = sources.map((source, index) => `[${index + 1}] ${source.title}\n${source.snippet}`).join("\n\n");
  return `${teaching} Ground factual claims in the sources below and cite them inline as [1] or [2]. If sources disagree, explain the disagreement. Do not add a link list.${pageBlock}\n${context}\nSources:\n${block}\n\nLatest student message: ${question}`;
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
  const page = body.data.page;
  const previousQuestion = [...history].reverse().find((turn) => turn.role === "student")?.text;
  // When the student taps a context chip (a short phrase like "Help me answer this"),
  // search using the page topic so sources are relevant to the debate/research session,
  // not just the chip text.
  const bareMessage = body.data.message;
  const searchBase = page && bareMessage.length < 40 ? `${page.label} ${bareMessage}` : bareMessage;
  const searchQuery = searchBase.length < 35 && previousQuestion
    ? `${previousQuestion} ${searchBase}`.slice(0, 500)
    : searchBase.slice(0, 500);
  const sources = await searchStudySources(searchQuery, 800);
  const links = sources.map(({ title, url }) => ({ title, url }));
  const prompt = studyPrompt(body.data.message, sources, history, page);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const piece of generateFastGeminiTextStream(prompt)) {
          if (piece) controller.enqueue(encoder.encode(piece));
        }
        controller.enqueue(encoder.encode(`${chatSourceTrailer}${JSON.stringify({ sources: links })}`));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
