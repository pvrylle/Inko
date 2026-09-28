"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { inkoFetch } from "@/lib/auth/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { useMascot } from "@/features/mascot/mascot-provider";
import { base64Pcm16ToFloat, floatToBase64Pcm16, resampleFloat32, rmsAmplitude } from "./audio-utils";
import { persistChatTurn } from "./voice-persistence";
import { executeVoiceTool } from "./voice-tools";
import type { StudySourceLink, ToolCall, VoiceConnectionState, VoiceMessage, VoiceServerEvent } from "./voice-types";

type TokenResponse = { token: string; agentId: string; voiceSessionId: string; maxSessionDurationSeconds: number; error?: string; message?: string };
type ToolResult = { callId: string; result: string; isError: boolean };

function getVoiceStartErrorMessage(caught: unknown) {
  if (caught instanceof DOMException) {
    switch (caught.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Microphone access is blocked. Allow microphone access for this site, then try again.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No microphone was detected. Connect or enable an input device in Windows sound settings, then try again.";
      case "NotReadableError":
      case "TrackStartError":
        return "Your microphone is busy or unavailable. Close other apps using it, then try again.";
      case "OverconstrainedError":
        return "The selected microphone cannot use the requested audio mode. Choose another input device and retry.";
      case "NotSupportedError":
      case "SecurityError":
        return "Live voice needs a supported browser on a secure connection (HTTPS or localhost).";
      case "AbortError":
        return "Microphone startup was interrupted. Please tap the microphone again.";
    }
  }
  return caught instanceof Error ? caught.message : "Voice could not start.";
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function hasAudioInputDevice() {
  if (!navigator.mediaDevices?.enumerateDevices) return true;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === "audioinput");
  } catch {
    // If enumeration itself fails, don't block — let getUserMedia be the source of truth.
    return true;
  }
}

// Acquire the microphone defensively. On Windows/Chrome, getUserMedia is often
// called before the media subsystem has finished enumerating input devices on a
// fresh page load, which throws a spurious NotFoundError even though a mic is
// present. We retry a couple of times (as long as a device actually exists)
// before surfacing the "no microphone" error to the student.
async function acquireMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("Media capture is unavailable.", "NotSupportedError");
  }

  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      // Use the browser's default input device without restrictive channel or
      // processing constraints. This works with more USB, Bluetooth, virtual,
      // and built-in microphones; AssemblyAI receives the normalized PCM below.
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (caught) {
      lastError = caught;
      const isMissing = caught instanceof DOMException && (caught.name === "NotFoundError" || caught.name === "DevicesNotFoundError");
      // Only retry the "no device" case, and only while a device is actually
      // reported — every other failure (permission, busy, etc.) is terminal.
      if (!isMissing || attempt === maxAttempts - 1 || !(await hasAudioInputDevice())) break;
      await sleep(250 * (attempt + 1));
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Browser dictation fallback (ChatGPT composer style).
// When the live AssemblyAI session can't start (voice not configured, backend
// hiccup, etc.), clicking the mic still captures the student's speech via the
// browser's SpeechRecognition API and streams the transcript into the hint,
// then sends it to Inko when they stop. The Web Speech API isn't in the DOM
// lib typings, so we describe the slice we use.
// ---------------------------------------------------------------------------
type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = { readonly length: number; isFinal: boolean; 0: SpeechRecognitionAlternativeLike };
type SpeechRecognitionResultListLike = { readonly length: number; [index: number]: SpeechRecognitionResultLike };
type SpeechRecognitionEventLike = { resultIndex: number; results: SpeechRecognitionResultListLike };
type SpeechRecognitionErrorEventLike = { error: string; message?: string };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

function getDictationErrorMessage(code: string) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow the mic for this site in your browser, and enable microphone access in Windows privacy settings, then try again.";
    case "audio-capture":
      return "No microphone was detected. Enable an input device in Windows sound settings, then try again.";
    case "no-speech":
      return "I didn't catch anything — tap the microphone and speak again.";
    case "network":
      return "Voice capture hiccuped. Tap the microphone to try again.";
    case "aborted":
      return ""; // The student stopped on purpose; not an error.
    default:
      return "Voice capture stopped unexpectedly. Tap the microphone to try again.";
  }
}

function replyErrorMessage() {
  return "Inko is not ready";
}

function spokenAnswer(text: string) {
  return text.replace(/\s*\[\d+\]/g, "").replace(/\s+/g, " ").trim();
}

function studySources(value: unknown): StudySourceLink[] {
  if (!Array.isArray(value)) return [];
  const links: StudySourceLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const title = "title" in item && typeof item.title === "string" ? item.title.trim() : "";
    const url = "url" in item && typeof item.url === "string" ? item.url.trim() : "";
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.protocol !== "https:" || !title) continue;
    links.push({ title: title.slice(0, 160), url: parsed.toString() });
    if (links.length >= 4) break;
  }
  return links;
}

const cuteVoiceNames = [/ana/i, /aria/i, /jenny/i, /samantha/i, /google uk english female/i, /zira/i];

function pickCuteVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  for (const pattern of cuteVoiceNames) {
    const match = english.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }
  return english[0];
}

export function useVoiceAgent() {
  const { userId, isGuest } = useAuth();
  const pathname = usePathname() ?? "";
  // Research keeps the live agent for tool calls. Everywhere else, including
  // home, speech is captured in the browser and answered by the fast chat model.
  const liveVoice = !isGuest && pathname.startsWith("/research");
  const { dispatch, setAmplitude, celebrate } = useMascot();
  const [connection, setConnection] = useState<VoiceConnectionState>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);
  const [replyPending, setReplyPending] = useState(false);
  const replyPendingRef = useRef(false);

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const readyRef = useRef(false);
  const voiceSessionIdRef = useRef<string | null>(null);
  const nextPlaybackTimeRef = useRef(0);
  const playbackSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const pendingToolsRef = useRef(new Map<string, ToolResult>());
  const latestEventRef = useRef("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationFinalRef = useRef("");
  const interimRef = useRef("");
  const handsFreeRef = useRef(false);
  const pauseForReplyRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const recoverableErrorsRef = useRef(0);
  const sendTextRef = useRef<(text: string) => void>(() => {});
  const resumeListeningRef = useRef<() => void>(() => {});
  const startDictationRef = useRef<() => boolean>(() => false);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current === null) return;
    window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  }, []);

  const markReplyPending = useCallback((pending: boolean) => {
    replyPendingRef.current = pending;
    setReplyPending(pending);
  }, []);

  const addMessage = useCallback((message: VoiceMessage) => {
    setMessages((current) => [...current.slice(-39), message]);
    if (message.role === "inko") markReplyPending(false);
    else if (message.role === "student") markReplyPending(true);
    if (userId) void persistChatTurn(userId, voiceSessionIdRef.current, message).catch(() => undefined);
  }, [markReplyPending, userId]);

  const send = useCallback((payload: object) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(payload));
  }, []);

  const speakReply = useCallback((text: string) => {
    setPartialTranscript(text);
    dispatch({ type: "AGENT_AUDIO" });
    const synth = window.speechSynthesis;
    if (!synth) {
      dispatch({ type: "REPLY_DONE" });
      resumeListeningRef.current();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.96;
    utterance.pitch = 1.25;
    let finished = false;
    let watchdog = 0;
    const finishSpeaking = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(watchdog);
      dispatch({ type: "REPLY_DONE" });
      resumeListeningRef.current();
    };
    utterance.onstart = () => {
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(finishSpeaking, Math.min(30_000, 1200 + text.length * 90));
    };
    utterance.onend = finishSpeaking;
    utterance.onerror = finishSpeaking;
    watchdog = window.setTimeout(finishSpeaking, 2500);
    const begin = () => {
      if (finished) return;
      const voice = pickCuteVoice(synth.getVoices());
      if (voice) {
        utterance.voice = voice;
        if (/ana|aria|jenny|samantha/i.test(voice.name)) utterance.pitch = 1.12;
      }
      const kick = () => {
        if (!finished) synth.speak(utterance);
      };
      if (synth.speaking || synth.pending) {
        synth.cancel();
        window.setTimeout(kick, 60);
      } else {
        kick();
      }
    };
    if (synth.getVoices().length > 0) begin();
    else {
      const onVoices = () => {
        synth.removeEventListener("voiceschanged", onVoices);
        begin();
      };
      synth.addEventListener("voiceschanged", onVoices);
      window.setTimeout(() => {
        synth.removeEventListener("voiceschanged", onVoices);
        begin();
      }, 300);
    }
  }, [dispatch, setPartialTranscript]);

  const flushToolResults = useCallback(() => {
    if (latestEventRef.current !== "reply.done") return;
    pendingToolsRef.current.forEach((toolResult, callId) => {
      send({ type: "tool.result", call_id: toolResult.callId, result: toolResult.result, is_error: toolResult.isError });
      pendingToolsRef.current.delete(callId);
    });
  }, [send]);

  const stopPlayback = useCallback(() => {
    playbackSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch {}
    });
    playbackSourcesRef.current.clear();
    nextPlaybackTimeRef.current = 0;
    setAmplitude(0);
  }, [setAmplitude]);

  const playAudio = useCallback((encoded: string) => {
    const context = audioContextRef.current;
    if (!context) return;
    const samples = base64Pcm16ToFloat(encoded);
    const buffer = context.createBuffer(1, samples.length, 24_000);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.015, nextPlaybackTimeRef.current);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + buffer.duration;
    playbackSourcesRef.current.add(source);
    setAmplitude(rmsAmplitude(samples));
    source.onended = () => {
      playbackSourcesRef.current.delete(source);
      if (!playbackSourcesRef.current.size) setAmplitude(0);
    };
  }, [setAmplitude]);

  const finalizeProviderSession = useCallback(async (keepalive = false) => {
    const voiceSessionId = voiceSessionIdRef.current;
    if (!voiceSessionId) return;
    try {
      const response = await inkoFetch("/api/voice/session/end", { method: "POST", body: JSON.stringify({ voiceSessionId }), keepalive });
      if (response.ok) voiceSessionIdRef.current = null;
    } catch {
      // Provider-session deletion is requested immediately when the call ends.
    }
  }, []);

  const cleanUpMedia = useCallback(() => {
    readyRef.current = false;
    workletRef.current?.disconnect();
    workletRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopPlayback();
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, [stopPlayback]);

  const handleToolCall = useCallback((call: ToolCall) => {
    // Route each tool name to the appropriate Jarvis-style workflow phase.
    // Planning phase: Inko is figuring out what to do.
    // Research phase: Inko is comparing evidence from sources.
    // Organising phase: Inko is pulling together the findings into a coherent output.
    // All other tools: generic working indicator.
    if (call.name === "plan_study_session" || call.name === "start_research" || call.name === "research_topic") {
      dispatch({ type: "WORK_STARTED", label: "Planning the approach." });
    } else if (call.name === "compare_sources" || call.name === "analyze_sources") {
      dispatch({ type: "RESEARCH_STARTED" });
    } else if (call.name === "organize_findings" || call.name === "summarize_findings") {
      dispatch({ type: "WORK_STARTED", label: "Organising the findings." });
    } else {
      dispatch({ type: "TOOL_STARTED", label: "Making that for you…" });
    }
    void executeVoiceTool(call).then(({ result, isError }) => {
      if (!isError && (call.name === "start_focus_session" || call.name === "control_focus_timer")) {
        const session = ("session" in result ? result.session : null) as { status?: string } | null | undefined;
        const focusing = session?.status === "active" || session?.status === "paused";
        dispatch({ type: "SET_MODE", mode: focusing ? "focus" : "normal" });
        if (session?.status === "completed") celebrate("Focus session complete!");
      }
      pendingToolsRef.current.set(call.call_id, { callId: call.call_id, result: JSON.stringify(result), isError });
      flushToolResults();
    });
  }, [celebrate, dispatch, flushToolResults]);

  const handleEvent = useCallback((event: VoiceServerEvent) => {
    latestEventRef.current = event.type;
    switch (event.type) {
      case "session.ready":
        readyRef.current = true;
        setConnection("connected");
        dispatch({ type: "SESSION_READY" });
        if (voiceSessionIdRef.current) {
          void inkoFetch("/api/voice/session", { method: "PATCH", body: JSON.stringify({ voiceSessionId: voiceSessionIdRef.current, providerSessionId: event.session_id }) });
        }
        break;
      case "input.speech.started":
        stopPlayback();
        dispatch({ type: "USER_STARTED" });
        break;
      case "input.speech.stopped":
        dispatch({ type: "USER_STOPPED" });
        break;
      case "transcript.user.delta":
        setPartialTranscript(event.text);
        break;
      case "transcript.user":
        setPartialTranscript("");
        addMessage({ id: crypto.randomUUID(), role: "student", text: event.text, createdAt: new Date().toISOString() });
        break;
      case "reply.started":
        dispatch({ type: "USER_STOPPED" });
        break;
      case "reply.audio":
        dispatch({ type: "AGENT_AUDIO" });
        playAudio(event.data);
        break;
      case "transcript.agent":
        addMessage({ id: crypto.randomUUID(), role: "inko", text: event.text, createdAt: new Date().toISOString(), interrupted: event.interrupted });
        break;
      case "tool.call":
        handleToolCall(event);
        break;
      case "reply.done":
        if (event.status === "interrupted") stopPlayback();
        dispatch({ type: "REPLY_DONE" });
        flushToolResults();
        break;
      case "session.ended":
        if (replyPendingRef.current) setError(replyErrorMessage());
        markReplyPending(false);
        setConnection("idle");
        dispatch({ type: "REPLY_DONE" });
        cleanUpMedia();
        void finalizeProviderSession();
        break;
      case "session.error":
      case "error":
        markReplyPending(false);
        setError(event.message || "The voice session ended unexpectedly.");
        setConnection("error");
        dispatch({ type: "ERROR" });
        cleanUpMedia();
        void finalizeProviderSession();
        break;
    }
  }, [addMessage, cleanUpMedia, dispatch, finalizeProviderSession, flushToolResults, handleToolCall, markReplyPending, playAudio, stopPlayback]);

  // Browser speech stays open. A short pause ends the sentence and Inko answers,
  // then listening starts again until the student taps to hang up.
  const startDictation = useCallback(() => {
    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      const message = "Live voice isn't available and this browser can't capture speech. Use Chrome or Edge, or type your question below.";
      setError(message);
      setConnection("error");
      dispatch({ type: "ERROR", message });
      return false;
    }
    if (recognitionRef.current) return true;

    try {
      const recognition = new RecognitionCtor();
      const language = navigator.language || "en-US";
      recognition.lang = language.toLowerCase().startsWith("en") ? "en-US" : language;
      // One utterance at a time. Chrome's continuous mode drops the Google
      // speech service and reports that as a network error.
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      dictationFinalRef.current = "";
      interimRef.current = "";

      const commitUtterance = () => {
        clearSilenceTimer();
        const text = `${dictationFinalRef.current} ${interimRef.current}`.trim();
        if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 2 || !handsFreeRef.current) return;
        dictationFinalRef.current = "";
        interimRef.current = "";
        pauseForReplyRef.current = true;
        setPartialTranscript("");
        setConnection("connected");
        dispatch({ type: "USER_STOPPED" });
        try { recognition.stop(); } catch {}
        sendTextRef.current(text);
      };

      recognition.onstart = () => {
        setDictating(true);
        setConnection("connected");
        setPartialTranscript("");
        dispatch({ type: "USER_STARTED" });
      };

      // Rebuild the whole transcript from every result on each event. Chrome
      // resends and revises earlier results, so appending duplicates words.
      recognition.onresult = (event) => {
        let finalText = "";
        let interim = "";
        let endsFinal = false;
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = (result[0]?.transcript ?? "").trim();
          if (!transcript) continue;
          if (result.isFinal) finalText += ` ${transcript}`;
          else interim += ` ${transcript}`;
          endsFinal = result.isFinal;
        }
        dictationFinalRef.current = finalText.trim();
        interimRef.current = interim.trim();
        const spoken = `${dictationFinalRef.current} ${interimRef.current}`.trim();
        setPartialTranscript(spoken);
        setError(null);
        clearSilenceTimer();
        if (spoken.replace(/[^\p{L}\p{N}]/gu, "").length < 2) return;
        recoverableErrorsRef.current = 0;
        silenceTimerRef.current = window.setTimeout(commitUtterance, endsFinal ? 250 : 700);
      };

      recognition.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        // Chrome reports "network" when its speech service blips, even while
        // the page is online. Keep the session open and let onend restart it.
        if (event.error === "network" && navigator.onLine) {
          recoverableErrorsRef.current += 1;
          return;
        }
        const message = getDictationErrorMessage(event.error);
        handsFreeRef.current = false;
        pauseForReplyRef.current = false;
        clearSilenceTimer();
        setDictating(false);
        if (message) {
          setError(message);
          setConnection("error");
          dispatch({ type: "ERROR", message });
        }
      };

      recognition.onend = () => {
        setDictating(false);
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        clearSilenceTimer();
        const leftover = `${dictationFinalRef.current} ${interimRef.current}`.trim();
        const meaningful = leftover.replace(/[^\p{L}\p{N}]/gu, "").length >= 2;
        if (handsFreeRef.current && !pauseForReplyRef.current && meaningful) {
          pauseForReplyRef.current = true;
          dictationFinalRef.current = "";
          interimRef.current = "";
          setPartialTranscript("");
          dispatch({ type: "USER_STOPPED" });
          sendTextRef.current(leftover);
          return;
        }
        if (!handsFreeRef.current || pauseForReplyRef.current) return;
        const delay = 350 + Math.min(recoverableErrorsRef.current, 6) * 400;
        window.setTimeout(() => {
          if (handsFreeRef.current && !pauseForReplyRef.current && !recognitionRef.current) startDictationRef.current();
        }, delay);
      };

      recognitionRef.current = recognition;
      recognition.start();
      return true;
    } catch (caught) {
      recognitionRef.current = null;
      if (caught instanceof DOMException && caught.name === "InvalidStateError" && handsFreeRef.current) {
        window.setTimeout(() => {
          if (handsFreeRef.current && !pauseForReplyRef.current && !recognitionRef.current) startDictationRef.current();
        }, 300);
        return true;
      }
      const message = caught instanceof Error ? caught.message : "Voice capture could not start.";
      setError(message);
      setConnection("error");
      dispatch({ type: "ERROR", message });
      return false;
    }
  }, [clearSilenceTimer, dispatch, setPartialTranscript]);

  const start = useCallback(async () => {
    if (connection === "connecting" || connection === "connected" || dictating) return;
    window.speechSynthesis?.cancel();
    setError(null);
    setConnection("connecting");

    // The live agent only runs on Research. Home answers through browser speech
    // and the fast chat model, so a question is not left waiting on AssemblyAI.
    if (!liveVoice) {
      handsFreeRef.current = true;
      pauseForReplyRef.current = false;
      startDictation();
      return;
    }

    try {
      // Secure the microphone before spinning up any audio resources, so a
      // missing/blocked device fails fast without leaking an AudioContext.
      const stream = await acquireMicrophone();
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext;
      const context = new AudioContextClass();
      audioContextRef.current = context;
      await context.resume();
      await context.audioWorklet.addModule("/pcm-worklet.js");

      const tokenResponse = await inkoFetch("/api/voice/token", { method: "POST" });
      const tokenPayload = (await tokenResponse.json()) as TokenResponse;
      if (!tokenResponse.ok) throw new Error(tokenPayload.message || tokenPayload.error || "Voice is not configured yet.");
      voiceSessionIdRef.current = tokenPayload.voiceSessionId;

      const socket = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(tokenPayload.token)}`);
      socketRef.current = socket;
      socket.onopen = () => send({ type: "session.update", session: { agent_id: tokenPayload.agentId } });
      socket.onmessage = (message) => {
        try { handleEvent(JSON.parse(String(message.data)) as VoiceServerEvent); } catch { setError("Inko received an unreadable voice event."); }
      };
      socket.onerror = () => handleEvent({ type: "session.error", code: "SOCKET_ERROR", message: "The voice connection could not be opened." });
      socket.onclose = () => {
        if (replyPendingRef.current) setError(replyErrorMessage());
        markReplyPending(false);
        setConnection("idle");
        cleanUpMedia();
        void finalizeProviderSession();
      };

      const source = context.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(context, "inko-pcm-processor");
      const silence = context.createGain();
      silence.gain.value = 0;
      source.connect(worklet).connect(silence).connect(context.destination);
      worklet.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
        if (!readyRef.current || socket.readyState !== WebSocket.OPEN) return;
        const samples = resampleFloat32(data, context.sampleRate);
        // Drive the shared listening visual from the student's microphone,
        // then let reply audio take over the same meter while Inko speaks.
        setAmplitude(Math.min(1, rmsAmplitude(samples) * 5));
        socket.send(JSON.stringify({ type: "input.audio", audio: floatToBase64Pcm16(samples) }));
      };
      workletRef.current = worklet;
    } catch (caught) {
      // The live session couldn't start. Rather than dead-ending on an error,
      // fall back to browser dictation so clicking the mic still captures the
      // student's voice. Only if dictation is unsupported do we surface the
      // original live-session error.
      cleanUpMedia();
      void finalizeProviderSession();
      handsFreeRef.current = true;
      pauseForReplyRef.current = false;
      const dictationStarted = startDictation();
      if (dictationStarted) return;
      const message = getVoiceStartErrorMessage(caught);
      setError(message);
      setConnection("error");
      dispatch({ type: "ERROR", message });
    }
  }, [cleanUpMedia, connection, dictating, dispatch, finalizeProviderSession, handleEvent, liveVoice, markReplyPending, send, setAmplitude, startDictation]);

  const resumeListening = useCallback(() => {
    pauseForReplyRef.current = false;
    if (!handsFreeRef.current) {
      setConnection("idle");
      return;
    }
    startDictation();
  }, [startDictation]);

  resumeListeningRef.current = resumeListening;
  startDictationRef.current = startDictation;

  const end = useCallback(() => {
    if (handsFreeRef.current || recognitionRef.current) {
      handsFreeRef.current = false;
      pauseForReplyRef.current = false;
      clearSilenceTimer();
      window.speechSynthesis?.cancel();
      dictationFinalRef.current = "";
      interimRef.current = "";
      setPartialTranscript("");
      setDictating(false);
      markReplyPending(false);
      setConnection("idle");
      try { recognitionRef.current?.stop(); } catch {}
      recognitionRef.current = null;
      return;
    }
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      setConnection("ending");
      send({ type: "session.end" });
      window.setTimeout(() => {
        socketRef.current?.close();
        setConnection("idle");
        cleanUpMedia();
        void finalizeProviderSession();
      }, 1800);
    } else {
      try { socketRef.current?.close(); } catch {}
      socketRef.current = null;
      cleanUpMedia();
      setConnection("idle");
      void finalizeProviderSession();
    }
  }, [cleanUpMedia, clearSilenceTimer, finalizeProviderSession, markReplyPending, send, setPartialTranscript]);

  const clearConversation = useCallback(() => {
    handsFreeRef.current = false;
    pauseForReplyRef.current = false;
    clearSilenceTimer();
    window.speechSynthesis?.cancel();
    dictationFinalRef.current = "";
    interimRef.current = "";
    try { recognitionRef.current?.abort(); } catch {}
    recognitionRef.current = null;
    try { socketRef.current?.close(); } catch {}
    socketRef.current = null;
    setPartialTranscript("");
    setDictating(false);
    setError(null);
    markReplyPending(false);
    setConnection("idle");
    setMessages([]);
  }, [clearSilenceTimer, markReplyPending, setPartialTranscript]);

  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const studentMessage: VoiceMessage = { id: crypto.randomUUID(), role: "student", text: trimmed, createdAt: new Date().toISOString() };
    addMessage(studentMessage);
    if (socketRef.current?.readyState === WebSocket.OPEN && readyRef.current) {
      send({ type: "conversation.message", role: "user", content: trimmed });
      send({ type: "reply.create" });
      dispatch({ type: "USER_STOPPED" });
      return;
    }

    dispatch({ type: "USER_STOPPED" });
    let response: Response;
    try {
      response = await inkoFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: trimmed }),
        signal: AbortSignal.timeout(22_000),
      });
    } catch {
      markReplyPending(false);
      setError(replyErrorMessage());
      dispatch({ type: "ERROR", message: replyErrorMessage() });
      resumeListeningRef.current();
      return;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (response.ok && contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string; sources?: unknown };
      const answer = payload.text?.trim();
      if (!answer || payload.error) {
        markReplyPending(false);
        setError(replyErrorMessage());
        dispatch({ type: "ERROR", message: replyErrorMessage() });
        resumeListeningRef.current();
        return;
      }
      const sources = studySources(payload.sources);
      addMessage({ id: crypto.randomUUID(), role: "inko", text: answer, createdAt: new Date().toISOString(), sources });
      speakReply(spokenAnswer(answer));
      return;
    }
    if (!response.ok || contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
      const blocked = payload.error === "GUEST_LIMIT";
      const message = blocked ? "Guest limit reached. Create a free account to keep going." : replyErrorMessage();
      markReplyPending(false);
      setError(message);
      dispatch({ type: "ERROR", message });
      if (blocked) {
        handsFreeRef.current = false;
        pauseForReplyRef.current = false;
        clearSilenceTimer();
        try { recognitionRef.current?.stop(); } catch {}
        recognitionRef.current = null;
        setDictating(false);
        setConnection("idle");
        window.dispatchEvent(new Event("inko:guest-limit"));
        return;
      }
      resumeListeningRef.current();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      markReplyPending(false);
      setError(replyErrorMessage());
      dispatch({ type: "ERROR", message: replyErrorMessage() });
      resumeListeningRef.current();
      return;
    }
    const decoder = new TextDecoder();
    let reply = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      reply += decoder.decode(value, { stream: true });
      const visible = reply.trim();
      if (visible) setPartialTranscript(visible);
    }
    reply = reply.trim();
    if (!reply) {
      markReplyPending(false);
      setError(replyErrorMessage());
      dispatch({ type: "ERROR", message: replyErrorMessage() });
      resumeListeningRef.current();
      return;
    }
    addMessage({ id: crypto.randomUUID(), role: "inko", text: reply, createdAt: new Date().toISOString() });
    speakReply(reply);
  }, [addMessage, clearSilenceTimer, dispatch, markReplyPending, send, speakReply]);

  // Keep a stable reference so the dictation callbacks can send captured text
  // without depending on sendText's identity.
  useEffect(() => {
    sendTextRef.current = sendText;
  }, [sendText]);

  useEffect(() => {
    const finalizeOnPageHide = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: "session.end" }));
      void finalizeProviderSession(true);
    };
    window.addEventListener("pagehide", finalizeOnPageHide);
    return () => {
      window.removeEventListener("pagehide", finalizeOnPageHide);
      if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: "session.end" }));
      try { socketRef.current?.close(); } catch {}
      try { recognitionRef.current?.abort(); } catch {}
      recognitionRef.current = null;
      void finalizeProviderSession(true);
      cleanUpMedia();
    };
  }, [cleanUpMedia, finalizeProviderSession]);

  return { connection, messages, partialTranscript, error, dictating, replyPending, start, end, sendText, clearConversation };
}
