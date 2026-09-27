import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { generateGeminiChat, isGeminiConfigured } from "@/lib/ai/gemini";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { toGeminiTurn, toOpenAICompletion, type BrainRequest } from "@/lib/voice/brain";

const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.union([z.string(), z.array(z.object({ type: z.string().optional(), text: z.string().optional() })), z.null()]).optional(),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
    tool_calls: z.array(z.object({
      id: z.string().optional(),
      function: z.object({ name: z.string().optional(), arguments: z.string().optional() }).optional(),
    })).optional(),
  })).min(1),
  tools: z.array(z.object({
    type: z.string().optional(),
    function: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
    }).optional(),
  })).optional(),
  stream: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const secret = process.env.VOICE_BRAIN_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return apiError("AUTH_REQUIRED", 401);
  if (!checkRateLimit("voice-brain", 120, 60_000).allowed) return apiError("RATE_LIMITED", 429);
  if (!isGeminiConfigured()) return apiError("GEMINI_NOT_CONFIGURED", 503);

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_REQUEST", 400);
  const turn = toGeminiTurn(parsed.data as BrainRequest);
  if (turn.contents.length === 0) return apiError("INVALID_REQUEST", 400);

  try {
    const result = await generateGeminiChat({ system: turn.system, contents: turn.contents, tools: turn.declarations });
    const completion = toOpenAICompletion(result);
    if (!parsed.data.stream) return NextResponse.json(completion);

    const payload = {
      id: completion.id,
      object: "chat.completion.chunk",
      model: result.model,
      choices: [{
        index: 0,
        delta: completion.choices[0]?.message,
        finish_reason: completion.choices[0]?.finish_reason ?? "stop",
      }],
    };
    return new Response(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`, {
      headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return apiError("GEMINI_FAILED", 502);
  }
}
