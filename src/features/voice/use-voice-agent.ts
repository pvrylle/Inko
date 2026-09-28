"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { inkoFetch } from "@/lib/auth/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useOptionalProjects } from "@/features/projects/project-provider";
import { createResearchSession } from "@/features/research/research-repository";
import { base64Pcm16ToFloat, floatToBase64Pcm16, resampleFloat32, rmsAmplitude } from "./audio-utils";
import { persistChatTurn } from "./voice-persistence";
import { deleteCompanionSession, getCompanionSessionSyncIssue, listCompanionSessions, makeCompanionSession, saveCompanionSession, subscribeToCompanionSessions, type CompanionSession } from "@/lib/data/companion-sessions";
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

const companionDestinations: Record<string, string> = {
  home: "/", projects: "/projects", debate: "/debate", timer: "/timer", research: "/research", sources: "/sources", canvas: "/canvas",
  practice: "/practice", history: "/history", settings: "/settings",
};

function navigationCommand(text: string) {
  const match = text.trim().toLowerCase().match(/^(?:please\s+)?(?:open|go to|show me)\s+(?:the\s+)?(home|projects|debate|timer|research|sources|canvas|practice|history|settings)(?:\s+page)?[.!?]?$/);
  return match ? companionDestinations[match[1]] : null;
}

function focusCommand(text: string) {
  const match = text.trim().match(/^(?:please\s+)?start\s+(?:a\s+)?(?:(\d{1,3})[- ]minute\s+)?focus\s+(?:session|timer)(?:\s+for\s+(\d{1,3})\s+minutes?)?[.!?]?$/i);
  return match ? Number(match[1] ?? match[2] ?? 25) : null;
}

function researchCommand(text: string) {
  return text.trim().match(/^(?:please\s+)?(?:start|create)\s+(?:a\s+)?research\s+(?:project\s+)?(?:on|about)\s+(.+)$/i)?.[1]?.trim() ?? null;
}

function debateCommand(text: string) {
  return text.trim().match(/^(?:please\s+)?(?:debate me on|start a debate (?:on|about))\s+(.+?)[.!?]?$/i)?.[1]?.trim() ?? null;
}

function timerCommand(text: string) {
  const match = text.trim().match(/^(?:please\s+)?start\s+(?:a\s+)?(\d{1,3})\s*(second|minute|hour)s?\s+timer[.!?]?$/i);
  if (!match) return null;
  return Number(match[1]) * (match[2].toLowerCase() === "hour" ? 3600 : match[2].toLowerCase() === "minute" ? 60 : 1);
}

function projectCommand(text: string) {
  return text.trim().match(/^(?:please\s+)?create\s+(?:a\s+)?project\s+called\s+(.+?)[.!?]?$/i)?.[1]?.trim() ?? null;
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
  const { userId, isGuest, isReady } = useAuth();
  const router = useRouter();
  const projects = useOptionalProjects();
  const pathname = usePathname() ?? "";
  // The signed-in companion can use its supported tools from Home or Research.
  const liveVoice = !isGuest && (pathname === "/" || pathname.startsWith("/research"));
  const { dispatch, setAmplitude, celebrate } = useMascot();
  const [connection, setConnection] = useState<VoiceConnectionState>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [sessions, setSessions] = useState<CompanionSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const activeSessionRef = useRef<CompanionSession | null>(null);
  const loadedOwnerRef = useRef<string | null>(null);
  const messagesRef = useRef<VoiceMessage[]>([]);
  const conversationVersionRef = useRef(0);
  const voiceStartGenerationRef = useRef(0);
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
  const recordingRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const inputMeterRef = useRef<{ stream: MediaStream; context: AudioContext; frame: number } | null>(null);
  const inputMeterGenerationRef = useRef(0);
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

  const stopInputMeter = useCallback(() => {
    inputMeterGenerationRef.current += 1;
    const meter = inputMeterRef.current;
    inputMeterRef.current = null;
    if (meter) {
      window.cancelAnimationFrame(meter.frame);
      meter.stream.getTracks().forEach((track) => track.stop());
      void meter.context.close().catch(() => undefined);
    }
    setAmplitude(0);
  }, [setAmplitude]);

  const startInputMeter = useCallback(async () => {
    stopInputMeter();
    const generation = inputMeterGenerationRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== inputMeterGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const meter = { stream, context, frame: 0 };
      inputMeterRef.current = meter;
      let previous = 0;
      const tick = (time: number) => {
        if (inputMeterRef.current !== meter) return;
        meter.frame = window.requestAnimationFrame(tick);
        if (time - previous < 50) return;
        previous = time;
        analyser.getFloatTimeDomainData(samples);
        setAmplitude(Math.min(1, rmsAmplitude(samples) * 6));
      };
      meter.frame = window.requestAnimationFrame(tick);
    } catch {
      // Dictation may still work even if a separate audio meter is unavailable.
    }
  }, [setAmplitude, stopInputMeter]);

  const markReplyPending = useCallback((pending: boolean) => {
    replyPendingRef.current = pending;
    setReplyPending(pending);
  }, []);

  useEffect(() => {
    if (!isReady || !userId) return;
    if (loadedOwnerRef.current !== userId) {
      loadedOwnerRef.current = userId;
      conversationVersionRef.current += 1;
      activeSessionRef.current = null;
      messagesRef.current = [];
      setActiveSessionId(null);
      setMessages([]);
      setSessions([]);
    }
    let cancelled = false;
    void listCompanionSessions(userId, isGuest).then((loaded) => {
      if (cancelled) return;
      setSessions((current) => {
        const merged = new Map(loaded.map((item) => [item.id, item]));
        for (const item of current) {
          const saved = merged.get(item.id);
          if (!saved || Date.parse(item.updated_at) >= Date.parse(saved.updated_at)) merged.set(item.id, item);
        }
        return [...merged.values()].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
      });
      if (activeSessionRef.current) return;
      const first = loaded[0];
      if (!first) return;
      activeSessionRef.current = first;
      messagesRef.current = first.messages;
      setActiveSessionId(first.id);
      setMessages(first.messages);
    }).catch(() => {
      if (!cancelled) setSessionError("Saved conversations could not be loaded.");
    });
    return () => { cancelled = true; };
  }, [isGuest, isReady, userId]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToCompanionSessions(userId, () => {
      setSessionError(getCompanionSessionSyncIssue(userId)?.message ?? null);
    });
  }, [userId]);

  const addMessage = useCallback((message: VoiceMessage) => {
    const nextMessages = [...messagesRef.current, message];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    if (message.role === "inko") markReplyPending(false);
    else if (message.role === "student") markReplyPending(true);
    if (userId) {
      const current = activeSessionRef.current ?? makeCompanionSession(userId, message.role === "student" ? message.text : "New chat");
      if (!activeSessionRef.current) projects?.assignConversation(current.id);
      const next: CompanionSession = {
        ...current,
        title: current.messages.length === 0 && message.role === "student" ? message.text.slice(0, 80) : current.title,
        messages: nextMessages,
        updated_at: new Date().toISOString(),
      };
      activeSessionRef.current = next;
      setActiveSessionId(next.id);
      setSessions((items) => [next, ...items.filter((item) => item.id !== next.id)]);
      void saveCompanionSession(userId, isGuest, next).catch(() => setSessionError("This conversation could not be saved."));
      if (voiceSessionIdRef.current) void persistChatTurn(userId, voiceSessionIdRef.current, message).catch(() => undefined);
    }
  }, [isGuest, markReplyPending, projects, userId]);

  const send = useCallback((payload: object) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(payload));
  }, []);

  const speakReply = useCallback((text: string) => {
    setPartialTranscript(text);
    dispatch({ type: "AGENT_AUDIO" });
    const synth = window.speechSynthesis;
    if (!synth) {
      setPartialTranscript("");
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
      setPartialTranscript("");
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
        void startInputMeter();
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
        stopInputMeter();
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
        stopInputMeter();
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
  }, [clearSilenceTimer, dispatch, setPartialTranscript, startInputMeter, stopInputMeter]);

  const startRecording = useCallback(async () => {
    if (!window.MediaRecorder) {
      const message = "This browser does not support voice capture. Use Chrome or Edge, or type your question.";
      setError(message);
      setConnection("error");
      dispatch({ type: "ERROR", message });
      return false;
    }
    try {
      const stream = await acquireMicrophone();
      recordingStreamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      let failed = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        failed = true;
        const message = "Microphone recording failed. Tap to try again.";
        setError(message);
        setConnection("error");
        dispatch({ type: "ERROR", message });
      };
      recorder.onstop = () => {
        if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
        recordingRef.current = null;
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        setDictating(false);
        if (failed) return;
        void (async () => {
          const audio = new Blob(chunks, { type: recorder.mimeType });
          if (!audio.size) throw new Error("No audio was captured. Tap the microphone and try again.");
          const form = new FormData();
          form.set("audio", audio, "recording");
          const response = await inkoFetch("/api/voice/transcribe", { method: "POST", body: form });
          const result = (await response.json()) as { text?: string };
          if (!response.ok) throw new Error("Voice transcription failed. Tap the microphone and try again.");
          const transcript = result.text?.trim();
          if (!transcript) throw new Error("I couldn't hear any words. Tap the microphone and speak again.");
          setPartialTranscript("");
          setConnection("idle");
          sendTextRef.current(transcript);
        })().catch((caught: unknown) => {
          const message = caught instanceof Error ? caught.message : "Voice transcription failed.";
          setError(message);
          setConnection("error");
          dispatch({ type: "ERROR", message });
        });
      };
      recordingRef.current = recorder;
      recorder.start();
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") {
          setDictating(false);
          setConnection("ending");
          setPartialTranscript("Transcribing your voice…");
          dispatch({ type: "USER_STOPPED" });
          recorder.stop();
        }
      }, 45_000);
      setDictating(true);
      setConnection("connected");
      dispatch({ type: "USER_STARTED" });
      return true;
    } catch (caught) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      const message = getVoiceStartErrorMessage(caught);
      setError(message);
      setConnection("error");
      dispatch({ type: "ERROR", message });
      return false;
    }
  }, [dispatch]);

  const start = useCallback(async () => {
    if (connection === "connecting" || connection === "connected" || dictating) return;
    const generation = ++voiceStartGenerationRef.current;
    window.speechSynthesis?.cancel();
    setError(null);
    setConnection("connecting");

    // Prefer live interim words for guests; retain recorded transcription as a
    // fallback when the browser does not provide speech recognition.
    if (!liveVoice) {
      handsFreeRef.current = true;
      pauseForReplyRef.current = false;
      if (getSpeechRecognitionConstructor() && startDictation()) return;
      handsFreeRef.current = false;
      setError(null);
      await startRecording();
      return;
    }

    try {
      // Secure the microphone before spinning up any audio resources, so a
      // missing/blocked device fails fast without leaking an AudioContext.
      const stream = await acquireMicrophone();
      if (generation !== voiceStartGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext;
      const context = new AudioContextClass();
      audioContextRef.current = context;
      await context.resume();
      if (generation !== voiceStartGenerationRef.current) return;
      await context.audioWorklet.addModule("/pcm-worklet.js");
      if (generation !== voiceStartGenerationRef.current) return;

      const tokenResponse = await inkoFetch("/api/voice/token", { method: "POST" });
      const tokenPayload = (await tokenResponse.json()) as TokenResponse;
      if (generation !== voiceStartGenerationRef.current) {
        if (tokenResponse.ok && tokenPayload.voiceSessionId) {
          void inkoFetch("/api/voice/session/end", { method: "POST", body: JSON.stringify({ voiceSessionId: tokenPayload.voiceSessionId }), keepalive: true }).catch(() => undefined);
        }
        return;
      }
      if (!tokenResponse.ok) throw new Error(tokenPayload.message || tokenPayload.error || "Voice is not configured yet.");
      voiceSessionIdRef.current = tokenPayload.voiceSessionId;

      const socket = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(tokenPayload.token)}`);
      socketRef.current = socket;
      const activeSocket = () => generation === voiceStartGenerationRef.current && socketRef.current === socket;
      socket.onopen = () => {
        if (activeSocket()) socket.send(JSON.stringify({ type: "session.update", session: { agent_id: tokenPayload.agentId } }));
      };
      socket.onmessage = (message) => {
        if (!activeSocket()) return;
        try { handleEvent(JSON.parse(String(message.data)) as VoiceServerEvent); } catch { setError("Inko received an unreadable voice event."); }
      };
      socket.onerror = () => {
        if (activeSocket()) handleEvent({ type: "session.error", code: "SOCKET_ERROR", message: "The voice connection could not be opened." });
      };
      socket.onclose = () => {
        if (!activeSocket()) return;
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
        if (!activeSocket() || !readyRef.current || socket.readyState !== WebSocket.OPEN) return;
        const samples = resampleFloat32(data, context.sampleRate);
        // Drive the shared listening visual from the student's microphone,
        // then let reply audio take over the same meter while Inko speaks.
        setAmplitude(Math.min(1, rmsAmplitude(samples) * 5));
        socket.send(JSON.stringify({ type: "input.audio", audio: floatToBase64Pcm16(samples) }));
      };
      workletRef.current = worklet;
    } catch (caught) {
      if (generation !== voiceStartGenerationRef.current) return;
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
  }, [cleanUpMedia, connection, dictating, dispatch, finalizeProviderSession, handleEvent, liveVoice, markReplyPending, setAmplitude, startDictation, startRecording]);

  const resumeListening = useCallback(() => {
    pauseForReplyRef.current = false;
    if (!handsFreeRef.current) {
      setConnection("idle");
      return;
    }
    startDictation();
  }, [startDictation]);

  useEffect(() => {
    resumeListeningRef.current = resumeListening;
    startDictationRef.current = startDictation;
  }, [resumeListening, startDictation]);

  const end = useCallback(() => {
    voiceStartGenerationRef.current += 1;
    const recorder = recordingRef.current;
    if (recorder?.state === "recording") {
      if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
      setDictating(false);
      setConnection("ending");
      setPartialTranscript("Transcribing your voice...");
      dispatch({ type: "USER_STOPPED" });
      recorder.stop();
      return;
    }
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
      stopInputMeter();
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
  }, [cleanUpMedia, clearSilenceTimer, dispatch, finalizeProviderSession, markReplyPending, send, setPartialTranscript, stopInputMeter]);

  const clearConversation = useCallback(() => {
    conversationVersionRef.current += 1;
    voiceStartGenerationRef.current += 1;
    activeSessionRef.current = null;
    messagesRef.current = [];
    setActiveSessionId(null);
    handsFreeRef.current = false;
    pauseForReplyRef.current = false;
    clearSilenceTimer();
    window.speechSynthesis?.cancel();
    dictationFinalRef.current = "";
    interimRef.current = "";
    try { recognitionRef.current?.abort(); } catch {}
    stopInputMeter();
    recognitionRef.current = null;
    if (recordingRef.current) {
      recordingRef.current.onstop = null;
      if (recordingRef.current.state === "recording") recordingRef.current.stop();
      recordingRef.current = null;
    }
    if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
    recordingTimeoutRef.current = null;
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    try { socketRef.current?.close(); } catch {}
    socketRef.current = null;
    cleanUpMedia();
    void finalizeProviderSession();
    setPartialTranscript("");
    setDictating(false);
    setError(null);
    markReplyPending(false);
    setConnection("idle");
    setMessages([]);
  }, [cleanUpMedia, clearSilenceTimer, finalizeProviderSession, markReplyPending, setPartialTranscript, stopInputMeter]);

  const currentOwnerRef = useRef(userId);
  useEffect(() => {
    if (currentOwnerRef.current && currentOwnerRef.current !== userId) clearConversation();
    currentOwnerRef.current = userId;
  }, [clearConversation, userId]);

  useEffect(() => {
    if (!isReady || !userId || isGuest) return;
    let cancelled = false;
    const refresh = () => {
      void listCompanionSessions(userId, false).then((latest) => {
        if (cancelled) return;
        setSessions(latest);
        const active = activeSessionRef.current;
        if (!active) return;
        const refreshed = latest.find((item) => item.id === active.id);
        if (!refreshed) {
          clearConversation();
        } else if (Date.parse(refreshed.updated_at) > Date.parse(active.updated_at)) {
          activeSessionRef.current = refreshed;
          messagesRef.current = refreshed.messages;
          setMessages(refreshed.messages);
        }
      }).catch(() => setSessionError("Saved conversations could not be refreshed."));
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [clearConversation, isGuest, isReady, userId]);

  const openConversation = useCallback((id: string) => {
    const session = sessions.find((item) => item.id === id);
    if (!session || session.id === activeSessionRef.current?.id) return;
    clearConversation();
    activeSessionRef.current = session;
    messagesRef.current = session.messages;
    setActiveSessionId(session.id);
    setMessages(session.messages);
  }, [clearConversation, sessions]);

  const linkResearchSession = useCallback((researchSessionId: string) => {
    if (!userId || !activeSessionRef.current) return;
    const linked = { ...activeSessionRef.current, research_session_id: researchSessionId };
    activeSessionRef.current = linked;
    setSessions((items) => items.map((item) => item.id === linked.id ? linked : item));
    void saveCompanionSession(userId, isGuest, linked).catch(() => setSessionError("This conversation could not be saved."));
  }, [isGuest, userId]);

  const renameConversation = useCallback((id: string, title: string) => {
    if (!userId || !title.trim()) return;
    const current = activeSessionRef.current?.id === id
      ? activeSessionRef.current
      : sessions.find((item) => item.id === id);
    if (!current) return;
    const renamed = { ...current, title: title.trim().slice(0, 160), updated_at: new Date().toISOString() };
    if (activeSessionRef.current?.id === id) activeSessionRef.current = renamed;
    setSessions((items) => [renamed, ...items.filter((item) => item.id !== id)]);
    void saveCompanionSession(userId, isGuest, renamed).catch(() => setSessionError("This conversation could not be saved."));
  }, [isGuest, sessions, userId]);

  const removeConversation = useCallback((id: string) => {
    if (!userId) return;
    if (activeSessionRef.current?.id === id) clearConversation();
    setSessions((items) => items.filter((item) => item.id !== id));
    void deleteCompanionSession(userId, isGuest, id).catch(() => setSessionError("This conversation could not be deleted."));
  }, [clearConversation, isGuest, userId]);

  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const studentMessage: VoiceMessage = { id: crypto.randomUUID(), role: "student", text: trimmed, createdAt: new Date().toISOString() };
    addMessage(studentMessage);
    const version = conversationVersionRef.current;
    const newProject = projectCommand(trimmed);
    if (newProject && projects) {
      const id = projects.createProject(newProject);
      addMessage({ id: crypto.randomUUID(), role: "inko", text: id ? `Created ${newProject}. What should we work on first?` : "I couldn't create that project.", createdAt: new Date().toISOString() });
      dispatch({ type: "REPLY_DONE" });
      if (id) router.push("/projects");
      return;
    }
    const destination = navigationCommand(trimmed);
    if (destination) {
      const responseText = `Opening ${destination === "/" ? "Home" : destination.slice(1)}.`;
      addMessage({ id: crypto.randomUUID(), role: "inko", text: responseText, createdAt: new Date().toISOString() });
      dispatch({ type: "REPLY_DONE" });
      router.push(destination);
      return;
    }
    const debateTopic = debateCommand(trimmed);
    if (debateTopic) {
      const href = `/debate?topic=${encodeURIComponent(debateTopic.slice(0, 200))}`;
      projects?.addActivity("debate", debateTopic, href);
      addMessage({ id: crypto.randomUUID(), role: "inko", text: `Let's debate ${debateTopic}. I'll take the other side.`, createdAt: new Date().toISOString() });
      dispatch({ type: "REPLY_DONE" });
      router.push(href);
      return;
    }
    const timerSeconds = timerCommand(trimmed);
    if (timerSeconds !== null) {
      if (timerSeconds < 1 || timerSeconds > 10800) {
        addMessage({ id: crypto.randomUUID(), role: "inko", text: "Choose a timer between 1 second and 3 hours.", createdAt: new Date().toISOString() });
        return;
      }
      const href = `/timer?seconds=${timerSeconds}`;
      projects?.addActivity("timer", `${timerSeconds} second timer`, href);
      addMessage({ id: crypto.randomUUID(), role: "inko", text: `Starting your timer.`, createdAt: new Date().toISOString() });
      dispatch({ type: "REPLY_DONE" });
      router.push(href);
      return;
    }
    const focusMinutes = focusCommand(trimmed);
    if (focusMinutes !== null) {
      if (focusMinutes < 1 || focusMinutes > 180) {
        addMessage({ id: crypto.randomUUID(), role: "inko", text: "Choose a focus session between 1 and 180 minutes.", createdAt: new Date().toISOString() });
        return;
      }
      dispatch({ type: "WORK_STARTED", label: "Starting your focus session." });
      const outcome = await executeVoiceTool({ call_id: crypto.randomUUID(), name: "start_focus_session", arguments: { minutes: focusMinutes } });
      if (version !== conversationVersionRef.current) return;
      addMessage({ id: crypto.randomUUID(), role: "inko", text: outcome.isError ? "I couldn't start focus right now. Please try again." : `Your ${focusMinutes} minute focus session is ready.`, createdAt: new Date().toISOString() });
      dispatch({ type: "REPLY_DONE" });
      if (!outcome.isError) {
        projects?.addActivity("timer", `${focusMinutes} minute focus`, "/focus");
        router.push("/focus");
      }
      return;
    }
    const topic = researchCommand(trimmed);
    if (topic) {
      if (topic.length < 10 || !userId) {
        addMessage({ id: crypto.randomUUID(), role: "inko", text: "Tell me a more specific research topic to start a project.", createdAt: new Date().toISOString() });
        return;
      }
      dispatch({ type: "RESEARCH_STARTED" });
      try {
        const project = await createResearchSession(userId, topic.slice(0, 500));
        if (version !== conversationVersionRef.current) return;
        linkResearchSession(project.id);
        if (projects?.activeId) projects.linkResearch(projects.activeId, project.id);
        projects?.addActivity("research", topic, `/research?session=${encodeURIComponent(project.id)}`);
        addMessage({ id: crypto.randomUUID(), role: "inko", text: `I opened a research project for ${topic}. We can review its sources and findings there.`, createdAt: new Date().toISOString() });
        dispatch({ type: "REPLY_DONE" });
        router.push(`/research?session=${encodeURIComponent(project.id)}`);
      } catch {
        if (version !== conversationVersionRef.current) return;
        addMessage({ id: crypto.randomUUID(), role: "inko", text: "I couldn't start that research project. Please try again.", createdAt: new Date().toISOString() });
        dispatch({ type: "ERROR", message: "Research could not start." });
      }
      return;
    }
    if (socketRef.current?.readyState === WebSocket.OPEN && readyRef.current) {
      send({ type: "conversation.message", role: "user", content: trimmed });
      send({ type: "reply.create" });
      dispatch({ type: "USER_STOPPED" });
      return;
    }

    dispatch({ type: "USER_STOPPED" });
    let response: Response;
    try {
      const currentDebate = pathname === "/debate" ? new URLSearchParams(window.location.search).get("topic")?.slice(0, 200) : null;
      const prompt = currentDebate
        ? `In a concise study debate about "${currentDebate}", challenge my reasoning with one clear counterargument and one question. My argument: ${trimmed}`
        : trimmed;
      response = await inkoFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: prompt, history: messagesRef.current.slice(-12, -1).map(({ role, text }) => ({ role, text })) }),
        signal: AbortSignal.timeout(22_000),
      });
    } catch {
      if (version !== conversationVersionRef.current) return;
      markReplyPending(false);
      setError(replyErrorMessage());
      dispatch({ type: "ERROR", message: replyErrorMessage() });
      resumeListeningRef.current();
      return;
    }
    if (version !== conversationVersionRef.current) return;
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
      if (version !== conversationVersionRef.current) return;
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
      if (version !== conversationVersionRef.current) { await reader.cancel(); return; }
      reply += decoder.decode(value, { stream: true });
      const visible = reply.trim();
      if (visible) setPartialTranscript(visible);
    }
    reply = reply.trim();
    if (version !== conversationVersionRef.current) return;
    if (!reply) {
      markReplyPending(false);
      setError(replyErrorMessage());
      dispatch({ type: "ERROR", message: replyErrorMessage() });
      resumeListeningRef.current();
      return;
    }
    addMessage({ id: crypto.randomUUID(), role: "inko", text: reply, createdAt: new Date().toISOString() });
    speakReply(reply);
  }, [addMessage, clearSilenceTimer, dispatch, linkResearchSession, markReplyPending, pathname, projects, router, send, speakReply, userId]);

  const sendAttachment = useCallback(async (file: File, question: string) => {
    if (!file.size || file.size > 8 * 1024 * 1024 || !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PDF, PNG, JPG, or WebP file under 8 MB.");
      return;
    }
    const text = question.trim() || `Explain ${file.name}`;
    const version = conversationVersionRef.current;
    addMessage({ id: crypto.randomUUID(), role: "student", text, attachment: { name: file.name, type: file.type }, createdAt: new Date().toISOString() });
    dispatch({ type: "USER_STOPPED" });
    const form = new FormData();
    form.set("file", file);
    form.set("message", question.trim());
    try {
      const response = await inkoFetch("/api/chat/attachment", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
      const payload = (await response.json()) as { text?: string; error?: string };
      if (version !== conversationVersionRef.current) return;
      if (!response.ok || !payload.text?.trim()) throw new Error(payload.error || "ANALYSIS_FAILED");
      const answer = payload.text.trim();
      addMessage({ id: crypto.randomUUID(), role: "inko", text: answer, createdAt: new Date().toISOString() });
      speakReply(spokenAnswer(answer));
    } catch {
      if (version !== conversationVersionRef.current) return;
      markReplyPending(false);
      setError("I couldn't read that file. Please try again.");
      dispatch({ type: "ERROR", message: "The file could not be read." });
    }
  }, [addMessage, dispatch, markReplyPending, speakReply]);

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
      if (recordingRef.current) {
        recordingRef.current.onstop = null;
        recordingRef.current.stop();
        recordingRef.current = null;
      }
      if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: "session.end" }));
      try { socketRef.current?.close(); } catch {}
      try { recognitionRef.current?.abort(); } catch {}
      stopInputMeter();
      recognitionRef.current = null;
      void finalizeProviderSession(true);
      cleanUpMedia();
    };
  }, [cleanUpMedia, finalizeProviderSession, stopInputMeter]);

  return { connection, messages, sessions, activeSessionId, sessionError, openConversation, linkResearchSession, renameConversation, removeConversation, partialTranscript, error, dictating, replyPending, start, end, sendText, sendAttachment, clearConversation };
}
