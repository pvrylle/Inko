import { z } from "zod";

export const generatedNoteSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(500),
  keyPoints: z.array(z.string().trim().min(1).max(500)).min(2).max(12),
  cleanedContent: z.string().trim().min(1).max(50_000),
});

export type GeneratedNote = z.infer<typeof generatedNoteSchema>;

export const generatedNoteJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "A concise descriptive study-note title." },
    summary: { type: "string", description: "A one or two sentence summary." },
    keyPoints: { type: "array", minItems: 2, maxItems: 12, items: { type: "string" }, description: "The most important facts or ideas." },
    cleanedContent: { type: "string", description: "The student's content cleaned for clarity while preserving all factual meaning." },
  },
  required: ["title", "summary", "keyPoints", "cleanedContent"],
} as const;

export function buildNoteMarkdown(note: GeneratedNote) {
  const points = note.keyPoints.map((point) => `- ${point}`).join("\n");
  return `# ${note.title}\n\n> ${note.summary}\n\n## Key points\n\n${points}\n\n## Study notes\n\n${note.cleanedContent.trim()}\n`;
}
