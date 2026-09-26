"use client";

import { inkoFetch } from "@/lib/auth/api-client";
import { upsertLocalRecord } from "@/lib/data/local-store";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { VoiceMessage } from "./voice-types";

export async function persistChatTurn(userId: string, voiceSessionId: string | null, message: VoiceMessage) {
  if (getBrowserSupabaseClient() && voiceSessionId) {
    const response = await inkoFetch("/api/voice/turns", {
      method: "POST",
      body: JSON.stringify({
        voiceSessionId,
        role: message.role,
        transcript: message.text,
        interrupted: message.interrupted ?? false,
      }),
    });
    if (!response.ok) throw new Error("TURN_SAVE_FAILED");
    return;
  }
  upsertLocalRecord("chat-turns", userId, { ...message, owner_id: userId, voice_session_id: voiceSessionId });
}
