import type { VoiceMessage } from "@/features/voice/voice-types";

export function replaceStudentMessage(messages: VoiceMessage[], id: string, text: string): VoiceMessage[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const index = messages.findIndex((message) => message.id === id && message.role === "student");
  if (index < 0) return null;
  return [...messages.slice(0, index), { ...messages[index], text: trimmed }];
}
