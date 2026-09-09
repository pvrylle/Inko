import { z } from "zod";

const studyRatingSchema = z.enum(["again", "hard", "good", "easy"]);

export const generatedFlashcardSchema = z.object({
  front: z.string().trim().min(1).max(1_000),
  back: z.string().trim().min(1).max(4_000),
  explanation: z.string().trim().min(1).max(2_000).nullable().optional(),
});

export const generatedFlashcardsSchema = z.object({
  cards: z.array(generatedFlashcardSchema).min(3).max(10),
}).superRefine(({ cards }, context) => {
  const seen = new Set<string>();
  cards.forEach((card, index) => {
    const normalized = card.front.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(normalized)) {
      context.addIssue({
        code: "custom",
        message: "Flashcard fronts must be unique.",
        path: ["cards", index, "front"],
      });
    }
    seen.add(normalized);
  });
});

export const generatedFlashcardsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      minItems: 3,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["front", "back", "explanation"],
        properties: {
          front: { type: "string", minLength: 1, maxLength: 1_000 },
          back: { type: "string", minLength: 1, maxLength: 4_000 },
          explanation: { type: ["string", "null"], maxLength: 2_000 },
        },
      },
    },
  },
} as const;

export const semanticGradeSchema = z.object({
  score: z.number().min(0).max(1),
  verdict: z.enum(["correct", "partial", "incorrect"]),
  feedback: z.string().trim().min(1).max(600),
  suggested_rating: studyRatingSchema,
});

export const semanticGradeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "verdict", "feedback", "suggested_rating"],
  properties: {
    score: { type: "number", minimum: 0, maximum: 1 },
    verdict: { type: "string", enum: ["correct", "partial", "incorrect"] },
    feedback: { type: "string", minLength: 1, maxLength: 600 },
    suggested_rating: { type: "string", enum: ["again", "hard", "good", "easy"] },
  },
} as const;
