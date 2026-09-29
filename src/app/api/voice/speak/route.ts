import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { streamAnnaSpeech, warmAnnaToken } from "@/lib/voice/anna-tts";

export const runtime = "nodejs";
export const maxDuration = 90;

const bodySchema = z.union([
  z.object({ warmup: z.literal(true) }),
  z.object({ text: z.string().trim().min(1).max(8_000) }),
]);

function writeFrame(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, payload: object) {
  if (controller.desiredSize === null) return false;
  try {
    controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
    return true;
  } catch {
    return false;
  }
}

function closeFrame(controller: ReadableStreamDefaultController<Uint8Array>) {
  if (controller.desiredSize === null) return;
  try { controller.close(); } catch { /* already closed by the client */ }
}

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
  const abort = new AbortController();
  const stop = () => abort.abort();
  request.signal.addEventListener("abort", stop, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await streamAnnaSpeech(spoken, (audio) => {
          if (!writeFrame(controller, encoder, { audio })) abort.abort();
        }, abort.signal);
        writeFrame(controller, encoder, { done: true, sampleRate: 24_000, voice: "anna" });
        closeFrame(controller);
      } catch (caught) {
        const cancelled = abort.signal.aborted || (caught instanceof Error && caught.message === "ANNA_TTS_CANCELLED");
        if (!cancelled) writeFrame(controller, encoder, { error: "ANNA_TTS_FAILED" });
        closeFrame(controller);
      } finally {
        request.signal.removeEventListener("abort", stop);
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
