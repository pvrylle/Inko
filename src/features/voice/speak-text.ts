"use client";

import { speakWithAnna, stopAnnaPlayback } from "./anna-player";
import { assignAnnaVoice } from "./speech-voice";

export function stopInkoSpeech() {
  stopAnnaPlayback();
  window.speechSynthesis?.cancel();
}

function speakWithBrowser(text: string, onEnd?: () => void) {
  const synth = window.speechSynthesis;
  if (!synth || !text.trim()) {
    onEnd?.();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  const begin = () => {
    assignAnnaVoice(utterance, synth.getVoices());
    synth.speak(utterance);
  };
  if (synth.getVoices().length > 0) begin();
  else synth.addEventListener("voiceschanged", begin, { once: true });
}

export async function speakInkoLine(text: string) {
  const spoken = text.replace(/\s+/g, " ").trim();
  if (!spoken) return false;
  const result = await speakWithAnna(spoken);
  if (result === "played" || result === "cancelled") return result === "played";
  await new Promise<void>((resolve) => speakWithBrowser(spoken, resolve));
  return true;
}
