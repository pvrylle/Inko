import "server-only";

import { prepareAnnaSpeech } from "@/lib/voice/speak-script";

const TOKEN_URL = "https://agents.assemblyai.com/v1/token";
const SOCKET_URL = "wss://agents.assemblyai.com/v1/ws";
const MAX_CHARS = 420;

type CachedToken = { value: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

export function splitAnnaSpeakChunks(text: string, max = MAX_CHARS) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const chunks: string[] = [];
  let rest = cleaned;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const breakAt = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! "),
      window.lastIndexOf(" "),
      0,
    );
    const minBreak = Math.min(40, Math.max(8, Math.floor(max * 0.45)));
    const at = breakAt >= minBreak ? breakAt + 1 : max;
    chunks.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function concatBase64Pcm(parts: string[]) {
  return Buffer.concat(parts.map((part) => Buffer.from(part, "base64"))).toString("base64");
}

function jsonPayload(data: unknown) {
  const raw = typeof data === "string"
    ? data
    : data instanceof ArrayBuffer
      ? new TextDecoder().decode(data)
      : Buffer.isBuffer(data)
        ? data.toString("utf8")
        : "";
  try {
    return JSON.parse(raw) as { type?: string; data?: string };
  } catch {
    return null;
  }
}

async function mintAgentToken(apiKey: string) {
  const params = new URLSearchParams({
    expires_in_seconds: "90",
    max_session_duration_seconds: "120",
  });
  const response = await fetch(`${TOKEN_URL}?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("VOICE_TOKEN_FAILED");
  const payload = (await response.json()) as { token?: string };
  if (!payload.token) throw new Error("VOICE_TOKEN_FAILED");
  return payload.token;
}

async function takeAgentToken(apiKey: string) {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 4_000) {
    const value = cachedToken.value;
    cachedToken = null;
    return value;
  }
  return mintAgentToken(apiKey);
}

export async function warmAnnaToken() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!apiKey) throw new Error("VOICE_NOT_CONFIGURED");
  if (cachedToken && cachedToken.expiresAt > Date.now() + 4_000) return;
  const value = await mintAgentToken(apiKey);
  cachedToken = { value, expiresAt: Date.now() + 80_000 };
}

async function streamChunk(apiKey: string, spoken: string, onAudio: (audio: string) => void, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("ANNA_TTS_CANCELLED");
  const token = await takeAgentToken(apiKey);
  if (signal?.aborted) throw new Error("ANNA_TTS_CANCELLED");
  let heard = false;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    const ws = new WebSocket(`${SOCKET_URL}?token=${encodeURIComponent(token)}`);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(quietTimer);
      signal?.removeEventListener("abort", onAbort);
      try { ws.send(JSON.stringify({ type: "session.end" })); } catch { /* already closed */ }
      try { ws.close(); } catch { /* ignore */ }
      if (error?.message === "ANNA_TTS_CANCELLED" && heard) resolve();
      else if (error) reject(error);
      else resolve();
    };
    const quietAfter = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => finish(), 1_500);
    };
    const onAbort = () => finish(new Error("ANNA_TTS_CANCELLED"));
    const timer = setTimeout(
      () => finish(heard ? undefined : new Error("ANNA_TTS_TIMEOUT")),
      Math.min(90_000, Math.max(45_000, 12_000 + spoken.length * 80)),
    );
    signal?.addEventListener("abort", onAbort, { once: true });

    ws.addEventListener("open", () => {
      if (settled) return;
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          system_prompt: "You are Inko's speaking voice. After the greeting, stay silent. Do not ask questions or add extra words.",
          greeting: spoken,
          tools: [],
          output: { voice: "anna", format: { encoding: "audio/pcm", sample_rate: 24_000 } },
          input: {
            format: { encoding: "audio/pcm" },
            turn_detection: { vad_threshold: 0.9, min_silence: 4000, max_silence: 5000, interrupt_response: false },
          },
        },
      }));
    });

    ws.addEventListener("message", (event) => {
      if (settled) return;
      const payload = jsonPayload(event.data);
      if (!payload?.type) return;
      if (payload.type === "reply.audio" && payload.data) {
        heard = true;
        try { onAudio(payload.data); } catch { finish(new Error("ANNA_TTS_CANCELLED")); return; }
      }
      if (payload.type === "transcript.agent") {
        if (heard) finish();
      }
      if (payload.type === "reply.done") {
        if (heard) quietAfter();
      }
      if (payload.type === "session.error" || payload.type === "error") finish(new Error("ANNA_TTS_FAILED"));
    });
    ws.addEventListener("error", () => finish(heard ? undefined : new Error("ANNA_TTS_FAILED")));
    ws.addEventListener("close", () => {
      if (heard) finish();
      else finish(new Error("ANNA_TTS_FAILED"));
    });
  });

  if (signal?.aborted && !heard) throw new Error("ANNA_TTS_CANCELLED");
  if (!heard) throw new Error("ANNA_TTS_FAILED");
}

export async function streamAnnaSpeech(text: string, onAudio: (audio: string) => void, signal?: AbortSignal) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!apiKey) throw new Error("VOICE_NOT_CONFIGURED");
  const parts = splitAnnaSpeakChunks(prepareAnnaSpeech(text));
  if (!parts.length) throw new Error("EMPTY_SPEECH");
  for (const part of parts) {
    if (signal?.aborted) throw new Error("ANNA_TTS_CANCELLED");
    await streamChunk(apiKey, part, onAudio, signal);
  }
}

export async function synthesizeAnnaSpeech(text: string) {
  const clips: string[] = [];
  await streamAnnaSpeech(text, (audio) => clips.push(audio));
  return concatBase64Pcm(clips);
}
