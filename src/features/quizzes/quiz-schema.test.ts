import { describe, expect, it } from "vitest";
import { generatedQuizSchema, normalizeQuizAnswer } from "./quiz-schema";

const question = (prompt: string) => ({
  prompt,
  options: ["Alpha", "Beta", "Gamma", "Delta"],
  correct_index: 1,
  explanation: "Beta is supported by the note.",
});

describe("generatedQuizSchema", () => {
  it("accepts four grounded multiple-choice questions", () => {
    expect(generatedQuizSchema.parse({ title: "Cell quiz", questions: [question("One?"), question("Two?"), question("Three?"), question("Four?")] }).questions).toHaveLength(4);
  });

  it("rejects duplicate prompts and options", () => {
    const duplicateOptions = { ...question("Unique?"), options: ["Same", " same ", "Other", "Last"] };
    const result = generatedQuizSchema.safeParse({ title: "Quiz", questions: [question("Repeated?"), question(" repeated? "), duplicateOptions, question("Fourth?")] });
    expect(result.success).toBe(false);
  });
});

describe("normalizeQuizAnswer", () => {
  const options = ["Mitosis", "Meiosis", "Interphase", "Cytokinesis"];

  it.each([["A", 0], ["option d", 3], ["2", 1], ["3.", 2], ["  meiosis ", 1]])("maps %s to option %s", (answer, expected) => {
    expect(normalizeQuizAnswer(answer as string, options)).toBe(expected);
  });

  it("rejects invalid or ambiguous answers", () => {
    expect(normalizeQuizAnswer("all of them", options)).toBeNull();
    expect(normalizeQuizAnswer(4, options)).toBeNull();
  });
});
