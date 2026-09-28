import "server-only";
import { transcribeAudio as transcribeWithGemini } from "@/lib/ai/gemini";

const BASE_URL = "https://api.assemblyai.com/v2";

async function assemblyRequest(path: string, apiKey: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { authorization: apiKey, ...init.headers },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`ASSEMBLYAI_${response.status}`);
  return response.json();
}

async function transcribeWithAssemblyAi(audio: Buffer, apiKey: string) {
  const upload = await assemblyRequest("/upload", apiKey, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: new Uint8Array(audio),
  }) as { upload_url?: string };
  if (!upload.upload_url) throw new Error("ASSEMBLYAI_UPLOAD_FAILED");

  const submitted = await assemblyRequest("/transcript", apiKey, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ audio_url: upload.upload_url, speech_models: ["universal-2"] }),
  }) as { id?: string };
  if (!submitted.id) throw new Error("ASSEMBLYAI_SUBMIT_FAILED");

  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = await assemblyRequest(`/transcript/${encodeURIComponent(submitted.id)}`, apiKey) as { status?: string; text?: string };
      if (result.status === "completed") return result.text?.trim() ?? "";
      if (result.status === "error") throw new Error("ASSEMBLYAI_TRANSCRIPTION_FAILED");
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("ASSEMBLYAI_TRANSCRIPTION_TIMEOUT");
  } finally {
    try {
      await fetch(`${BASE_URL}/transcript/${encodeURIComponent(submitted.id)}`, {
        method: "DELETE",
        headers: { authorization: apiKey },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // The result still reaches the student if the provider deletion request fails.
    }
  }
}

export async function transcribeVoice(audio: Buffer, mimeType: string) {
  const assemblyKey = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (assemblyKey) return transcribeWithAssemblyAi(audio, assemblyKey);
  return transcribeWithGemini(audio, mimeType);
}
