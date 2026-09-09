import { z } from "zod";

const generatedQuestionSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  options: z.array(z.string().trim().min(1).max(500)).length(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(1).max(1_500),
}).superRefine(({ options }, context) => {
  const normalized = options.map((option) => option.toLocaleLowerCase().replace(/\s+/g, " ").trim());
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: "custom", message: "Quiz options must be unique.", path: ["options"] });
  }
});

export const generatedQuizSchema = z.object({
  title: z.string().trim().min(1).max(160),
  questions: z.array(generatedQuestionSchema).min(4).max(8),
}).superRefine(({ questions }, context) => {
  const seen = new Set<string>();
  questions.forEach((question, index) => {
    const normalized = question.prompt.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(normalized)) context.addIssue({ code: "custom", message: "Quiz prompts must be unique.", path: ["questions", index, "prompt"] });
    seen.add(normalized);
  });
});

export const generatedQuizJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "questions"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 160 },
    questions: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prompt", "options", "correct_index", "explanation"],
        properties: {
          prompt: { type: "string", minLength: 1, maxLength: 2_000 },
          options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 500 } },
          correct_index: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string", minLength: 1, maxLength: 1_500 },
        },
      },
    },
  },
} as const;

function normalizedOption(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeQuizAnswer(answer: string | number, options: string[]): number | null {
  if (typeof answer === "number") return Number.isInteger(answer) && answer >= 0 && answer < options.length ? answer : null;
  const normalized = normalizedOption(answer).replace(/[.)]$/, "");
  const token = normalized.match(/^(?:option\s+)?([a-d]|[1-4])$/)?.[1];
  if (token) return /^[a-d]$/.test(token) ? token.charCodeAt(0) - 97 : Number(token) - 1;
  const matches = options.map(normalizedOption).map((option, index) => option === normalized ? index : -1).filter((index) => index >= 0);
  return matches.length === 1 ? matches[0] : null;
}
