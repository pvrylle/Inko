import { describe, expect, it } from "vitest";
import { sessionStudyContext } from "./chat-suggestions";
import type { VoiceMessage } from "@/features/voice/voice-types";

function turn(role: VoiceMessage["role"], text: string, id = crypto.randomUUID()): VoiceMessage {
  return { id, role, text, createdAt: new Date().toISOString() };
}

describe("sessionStudyContext", () => {
  it("derives topic and Q&A from the open chat", () => {
    const messages = [
      turn("student", "Can you tell me more about C programming?"),
      turn("inko", "C is a systems language used for operating systems, embedded work, and performance-sensitive apps."),
    ];
    const ctx = sessionStudyContext(messages, "C programming");
    expect(ctx.topic).toBe("C programming");
    expect(ctx.question).toContain("C programming");
    expect(ctx.answer?.text).toContain("systems language");
  });

  it("falls back to the student question when the session title is default", () => {
    const messages = [turn("student", "Explain photosynthesis for my biology exam")];
    const ctx = sessionStudyContext(messages, "New chat");
    expect(ctx.topic.toLowerCase()).toContain("photosynthesis");
    expect(ctx.answer).toBeNull();
  });
});
