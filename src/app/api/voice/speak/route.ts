import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { streamAnnaSpeech, warmAnnaToken } from "@/lib/voice/anna-tts";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.union([
  z.object({ warmup: z.literal(true) }),
  z.object({ text: z.string().trim().min(1).max(2_400) }),
]);

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || "local";
  if (!checkRateLimit(`voice-speak:${user?.userId ?? address}`, 20, 60_000).allowed) {
    return apiError("RATE_LIMITED", 429);
  }
  if (!process.env.ASSEMBLYAI_API_KEY?.trim()) return apiError("VOICE_NOT_CONFIGURED", 503);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_SPEECH", 400);

  if ("warmup" in body.data) {
    try {
      await warmAnnaToken();
      return new NextResponse(null, { status: 204 });
    } catch {
      return apiError("ANNA_TTS_FAILED", 502);
    }
  }

  const encoder = new TextEncoder();
  const spoken = body.data.text;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await streamAnnaSpeech(spoken, (audio) => {
          controller.enqueue(encoder.encode(`${JSON.stringify({ audio })}\n`));
        });
        controller.enqueue(encoder.encode(`${JSON.stringify({ done: true, sampleRate: 24_000, voice: "anna" })}\n`));
        controller.close();
      } catch (caught) {
        const error = caught instanceof Error && caught.message === "VOICE_NOT_CONFIGURED"
          ? "VOICE_NOT_CONFIGURED"
          : "ANNA_TTS_FAILED";
        controller.enqueue(encoder.encode(`${JSON.stringify({ error })}\n`));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
