import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { transcribeVoice } from "@/lib/voice/transcribe";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["audio/webm", "audio/mp4", "audio/ogg"]);

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || "local";
  const limitKey = user && !user.isDemo ? `voice-transcribe:${user.userId}` : `voice-transcribe:guest:${address}`;
  if (!checkRateLimit(limitKey, user && !user.isDemo ? 20 : 10, user && !user.isDemo ? 60_000 : 86_400_000).allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_AUDIO_BYTES + 1024) {
    return NextResponse.json({ error: "INVALID_AUDIO" }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "INVALID_AUDIO" }, { status: 400 });
  }
  const mimeType = audio.type.split(";")[0].toLowerCase();
  if (!SUPPORTED_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "UNSUPPORTED_AUDIO" }, { status: 415 });
  }
  try {
    const text = await transcribeVoice(Buffer.from(await audio.arrayBuffer()), mimeType);
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "TRANSCRIPTION_FAILED" }, { status: 502 });
  }
}
