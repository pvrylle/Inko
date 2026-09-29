import { replaceStudentMessage } from "./edit-student-message";
import type { VoiceMessage } from "@/features/voice/voice-types";

function turn(id: string, role: VoiceMessage["role"], text: string): VoiceMessage {
  return { id, role, text, createdAt: "2026-09-30T00:00:00.000Z" };
}

describe("replaceStudentMessage", () => {
  const thread = [
    turn("q1", "student", "What is mitosis?"),
    turn("a1", "inko", "Cell division."),
    turn("q2", "student", "And meiosis?"),
    turn("a2", "inko", "Makes gametes."),
  ];

  it("rewrites the student turn and drops everything after it", () => {
    expect(replaceStudentMessage(thread, "q1", "What is meiosis?")).toEqual([
      { ...thread[0], text: "What is meiosis?" },
    ]);
  });

  it("keeps earlier turns when a later question is edited", () => {
    expect(replaceStudentMessage(thread, "q2", "  How does meiosis differ?  ")).toEqual([
      thread[0],
      thread[1],
      { ...thread[2], text: "How does meiosis differ?" },
    ]);
  });

  it("rejects empty text and unknown ids", () => {
    expect(replaceStudentMessage(thread, "q1", "   ")).toBeNull();
    expect(replaceStudentMessage(thread, "a1", "Nope")).toBeNull();
    expect(replaceStudentMessage(thread, "missing", "Hello")).toBeNull();
  });
});
