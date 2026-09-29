"use client";

import { useEffect, useRef, useState } from "react";

type SpeechResult = { readonly length: number; isFinal: boolean; 0?: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: { readonly length: number; [index: number]: SpeechResult } };

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognitionConstructor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/** Browser speech for a live debate turn. A short pause sends the utterance. */
export function useDebateMic(onUtterance: (text: string) => void) {
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;
  const recognitionRef = useRef<Recognition | null>(null);
  const silenceRef = useRef<number | null>(null);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window === "undefined" ? true : recognitionConstructor() !== null;

  const stop = () => {
    if (silenceRef.current !== null) window.clearTimeout(silenceRef.current);
    silenceRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try { recognition?.abort(); } catch { /* already stopped */ }
    setListening(false);
    setPartial("");
  };

  const start = () => {
    const Ctor = recognitionConstructor();
    if (!Ctor) {
      setError("This browser can't use the microphone. Type the argument instead.");
      return;
    }
    stop();
    setError(null);
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let finals = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const piece = event.results[index]?.[0]?.transcript ?? "";
        if (event.results[index]?.isFinal) finals = `${finals} ${piece}`.trim();
        else interim = piece;
      }
      setPartial(`${finals} ${interim}`.trim());
      if (silenceRef.current !== null) window.clearTimeout(silenceRef.current);
      if (!finals) return;
      silenceRef.current = window.setTimeout(() => {
        const text = finals.trim();
        finals = "";
        if (text) onUtteranceRef.current(text);
      }, 900);
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(event.error === "not-allowed" ? "Allow the microphone for this site, then try again." : "The microphone stopped. Tap it to try again.");
      stop();
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError("The microphone could not start.");
    }
  };

  useEffect(() => () => {
    if (silenceRef.current !== null) window.clearTimeout(silenceRef.current);
    try { recognitionRef.current?.abort(); } catch { /* already stopped */ }
  }, []);

  return { error, listening, partial, start, stop, supported };
}
