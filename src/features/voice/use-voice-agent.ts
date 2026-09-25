"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inkoFetch } from "@/lib/auth/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { useMascot } from "@/features/mascot/mascot-provider";
import { base64Pcm16ToFloat, floatToBase64Pcm16, resampleFloat32, rmsAmplitude } from "./audio-utils";
import { persistChatTurn } from "./voice-persistence";
import { executeVoiceTool } from "./voice-tools";
import type { ToolCall, VoiceConnectionState, VoiceMessage, VoiceServerEvent } from "./voice-types";

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
      return "Voice capture needs an internet connection right now. Check your connection and retry.";
    case "aborted":
      return ""; // The student stopped on purpose; not an error.
    default:
      return "Voice capture stopped unexpectedly. Tap the microphone to try again.";
  }
}

export function useVoiceAgent() {
  const { userId } = useAuth();
  const { dispatch, setAmplitude, celebrate } = useMascot();
  const [connection, setConnection] = useState<VoiceConnectionState>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);

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
  const sendTextRef = useRef<(text: string) => void>(() => {});

  const addMessage = useCallback((message: VoiceMessage) => {
    setMessages((current) => [...current.slice(-39), message]);
    if (userId) void persistChatTurn(userId, voiceSessionIdRef.current, message).catch(() => undefined);
  }, [userId]);

  const send = useCallback((payload: object) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(payload));
  }, []);

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
      // The protected cleanup cron retries stale and deletion-pending sessions.
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
    if (call.name === "plan_study_session") {
      dispatch({ type: "WORK_STARTED", label: "Planning the approach." });
    } else if (call.name === "research_topic" || call.name === "compare_sources" || call.name === "analyze_sources") {
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
        setConnection("idle");
        dispatch({ type: "REPLY_DONE" });
        cleanUpMedia();
        void finalizeProviderSession();
        break;
      case "session.error":
      case "error":
        setError(event.message || "The voice session ended unexpectedly.");
        setConnection("error");
        dispatch({ type: "ERROR" });
        cleanUpMedia();
        void finalizeProviderSession();
        break;
    }
  }, [addMessage, cleanUpMedia, dispatch, finalizeProviderSession, flushToolResults, handleToolCall, playAudio, stopPlayback]);

  // ChatGPT-style dictation: capture speech in the browser, stream the live
  // transcript into the hint, and send it to Inko when recording stops.
  const startDictation = useCallback(() => {
    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      const message = "Live voice isn't available and this browser can't capture speech. Use Chrome or Edge, or type your question below.";
      setError(message);
      setConnection("error");
      dispatch({ type: "ERROR", message });
      return false;
    }

    try {
      const recognition = new RecognitionCtor();
      recognition.lang = navigator.language || "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      dictationFinalRef.current = "";

      recognition.onstart = () => {
        setError(null);
        setDictating(true);
        setConnection("connected");
        setPartialTranscript("");
        dispatch({ type: "USER_STARTED" });
      };

      recognition.onresult = (event) => {
        let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript ?? "";
          if (result.isFinal) dictationFinalRef.current += transcript;
          else interim += transcript;
        }
        setPartialTranscript(`${dictationFinalRef.current} ${interim}`.trim());
      };

      recognition.onerror = (event) => {
        const message = getDictationErrorMessage(event.error);
        setDictating(false);
        if (message) {
          setError(message);
          setConnection("error");
          dispatch({ type: "ERROR", message });
        }
      };

      recognition.onend = () => {
        setDictating(false);
        recognitionRef.current = null;
        const finalText = dictationFinalRef.current.trim();
        setPartialTranscript("");
        setConnection("idle");
        if (finalText) sendTextRef.current(finalText);
        else dispatch({ type: "REPLY_DONE" });
      };

      recognitionRef.current = recognition;
      recognition.start();
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Voice capture could not start.";
      setError(message);
      setConnection("error");
      dispatch({ type: "ERROR", message });
      return false;
    }
  }, [dispatch]);

  const start = useCallback(async () => {
    if (connection === "connecting" || connection === "connected" || dictating) return;
    setError(null);
    setConnection("connecting");

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
      const dictationStarted = startDictation();
      if (dictationStarted) return;
      const message = getVoiceStartErrorMessage(caught);
      setError(message);
      setConnection("error");
      dispatch({ type: "ERROR", message });
    }
  }, [cleanUpMedia, connection, dictating, dispatch, finalizeProviderSession, handleEvent, send, setAmplitude, startDictation]);

  const end = useCallback(() => {
    // Dictation fallback: stopping triggers recognition.onend, which sends the
    // captured transcript to Inko.
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
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
  }, [cleanUpMedia, finalizeProviderSession, send]);

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
    const response = await inkoFetch("/api/chat", { method: "POST", body: JSON.stringify({ message: trimmed }) });
    const payload = (await response.json()) as { text?: string; error?: string };
    if (!response.ok || !payload.text) {
      const message = payload.error === "GEMINI_NOT_CONFIGURED" ? "Add GEMINI_API_KEY to let me answer typed questions." : "I couldn't answer that just now.";
      setError(message);
      dispatch({ type: "ERROR", message });
      return;
    }
    addMessage({ id: crypto.randomUUID(), role: "inko", text: payload.text, createdAt: new Date().toISOString() });
    dispatch({ type: "REPLY_DONE" });
  }, [addMessage, dispatch, send]);

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

  return { connection, messages, partialTranscript, error, dictating, start, end, sendText };
}
