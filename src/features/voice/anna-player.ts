"use client";

import { inkoFetch } from "@/lib/auth/api-client";
import { base64Pcm16ToFloat } from "./audio-utils";
import { cuteCharacterVoice } from "./speech-voice";

export type AnnaSpeakResult = "played" | "failed" | "cancelled";

let speakGeneration = 0;
let speakAbort: AbortController | null = null;
let playback: AudioContext | null = null;
let activeSources = 0;
let nextTime = 0;

function audioContext() {
  playback ??= new AudioContext();
  return playback;
}

export function prepareAnnaPlayback() {
  void audioContext().resume().catch(() => undefined);
}

export function stopAnnaPlayback() {
  speakGeneration += 1;
  speakAbort?.abort();
  speakAbort = null;
  activeSources = 0;
  nextTime = 0;
  const context = playback;
  playback = null;
  void context?.close().catch(() => undefined);
}

export async function warmAnnaVoice() {
  prepareAnnaPlayback();
  try {
    await inkoFetch("/api/voice/speak", {
      method: "POST",
      body: JSON.stringify({ warmup: true }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    // First spoken sentence still mints its own token if warmup misses.
  }
}

function queuePcm(samples: Float32Array, generation: number) {
  if (!samples.length || generation !== speakGeneration) return;
  const context = audioContext();
  const buffer = context.createBuffer(1, samples.length, 24_000);
  buffer.getChannelData(0).set(samples);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = cuteCharacterVoice.rate;
  const gain = context.createGain();
  gain.gain.value = 1.55;
  source.connect(gain).connect(context.destination);
  const startAt = Math.max(context.currentTime + 0.02, nextTime);
  activeSources += 1;
  source.start(startAt);
  nextTime = startAt + buffer.duration / source.playbackRate.value;
  source.onended = () => {
    activeSources = Math.max(0, activeSources - 1);
  };
}

async function waitForQueuedAudio(generation: number) {
  const context = playback;
  if (!context || generation !== speakGeneration) return;
  while (generation === speakGeneration && (activeSources > 0 || nextTime > context.currentTime + 0.02)) {
    const waitMs = Math.max(20, Math.min(250, (nextTime - context.currentTime) * 1_000));
    await new Promise((resolve) => window.setTimeout(resolve, waitMs));
  }
}

export async function speakWithAnna(text: string): Promise<AnnaSpeakResult> {
  const spoken = text.replace(/\s+/g, " ").trim().slice(0, 2_400);
  if (!spoken) return "failed";
  const generation = speakGeneration;
  speakAbort ??= new AbortController();
  const abort = speakAbort;
  let heard = false;

  try {
    prepareAnnaPlayback();
    const response = await inkoFetch("/api/voice/speak", {
      method: "POST",
      body: JSON.stringify({ text: spoken }),
      signal: abort.signal,
    });
    if (generation !== speakGeneration) return "cancelled";
    if (!response.ok || !response.body) return "failed";

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let leftover = "";
    while (generation === speakGeneration) {
      const { done, value } = await reader.read();
      leftover += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = leftover.split("\n");
      leftover = done ? "" : lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let payload: { audio?: string; error?: string };
        try {
          payload = JSON.parse(trimmed) as { audio?: string; error?: string };
        } catch {
          continue;
        }
        if (payload.error && !heard) {
          await reader.cancel().catch(() => undefined);
          return "failed";
        }
        if (payload.audio) {
          heard = true;
          queuePcm(base64Pcm16ToFloat(payload.audio), generation);
        }
      }
      if (done) break;
    }
    if (generation !== speakGeneration) return "cancelled";
    if (!heard) return "failed";
    await waitForQueuedAudio(generation);
    return generation === speakGeneration ? "played" : "cancelled";
  } catch (caught) {
    if (generation !== speakGeneration || (caught instanceof DOMException && caught.name === "AbortError")) {
      return "cancelled";
    }
    return heard ? "played" : "failed";
  }
}
