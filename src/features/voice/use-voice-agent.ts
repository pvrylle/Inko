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

export function useVoiceAgent() {
  const { userId } = useAuth();
  const { dispatch, setAmplitude, celebrate } = useMascot();
  const [connection, setConnection] = useState<VoiceConnectionState>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    dispatch({ type: "TOOL_STARTED", label: "Making that for you…" });
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

  const start = useCallback(async () => {
    if (connection === "connecting" || connection === "connected") return;
    setError(null);
    setConnection("connecting");

    try {
      const AudioContextClass = window.AudioContext;
      const context = new AudioContextClass();
      audioContextRef.current = context;
      await context.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: true },
      });
      streamRef.current = stream;
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
        socket.send(JSON.stringify({ type: "input.audio", audio: floatToBase64Pcm16(samples) }));
      };
      workletRef.current = worklet;
    } catch (caught) {
      const message = caught instanceof DOMException && caught.name === "NotAllowedError"
        ? "Microphone access was blocked. You can still type to Inko."
        : caught instanceof Error ? caught.message : "Voice could not start.";
      setError(message);
      setConnection("error");
      dispatch({ type: "ERROR", message });
      cleanUpMedia();
      void finalizeProviderSession();
    }
  }, [cleanUpMedia, connection, dispatch, finalizeProviderSession, handleEvent, send]);

  const end = useCallback(() => {
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
      void finalizeProviderSession(true);
      cleanUpMedia();
    };
  }, [cleanUpMedia, finalizeProviderSession]);

  return { connection, messages, partialTranscript, error, start, end, sendText };
}
