"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { upsertLocalRecord } from "@/lib/data/local-store";
import type { VoiceMessage } from "./voice-types";

export async function persistChatTurn(userId: string, voiceSessionId: string | null, message: VoiceMessage) {
  const supabase = getBrowserSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from("chat_turns").insert({
      id: message.id,
      owner_id: userId,
      voice_session_id: voiceSessionId,
      role: message.role,
      transcript: message.text,
      interrupted: message.interrupted ?? false,
      created_at: message.createdAt,
    });
    if (error) throw error;
    return;
  }
  upsertLocalRecord("chat-turns", userId, { ...message, owner_id: userId, voice_session_id: voiceSessionId });
}
