import { describe, expect, it } from "vitest";
import { generatedFlashcardsSchema, semanticGradeSchema } from "./flashcard-schema";

describe("generatedFlashcardsSchema", () => {
  it("accepts a useful unique card set", () => {
    const parsed = generatedFlashcardsSchema.parse({ cards: [
      { front: "What is mitosis?", back: "Cell division.", explanation: null },
      { front: "Why is mitosis useful?", back: "Growth and repair.", explanation: "It preserves chromosome count." },
      { front: "When does DNA replicate?", back: "Before mitosis.", explanation: null },
    ] });
    expect(parsed.cards).toHaveLength(3);
  });

  it("rejects duplicate fronts after normalization", () => {
    const result = generatedFlashcardsSchema.safeParse({ cards: [
      { front: "What is ATP?", back: "Energy currency." },
      { front: "  WHAT   IS ATP? ", back: "A nucleotide." },
      { front: "Where is ATP made?", back: "Mostly mitochondria." },
    ] });
    expect(result.success).toBe(false);
  });
});

describe("semanticGradeSchema", () => {
  it("rejects scores outside zero to one", () => {
    expect(semanticGradeSchema.safeParse({ score: 1.2, verdict: "correct", feedback: "Good", suggested_rating: "easy" }).success).toBe(false);
  });
});
