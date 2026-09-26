import { z } from "zod";

const sourceId = z.string().trim().min(1).max(80);

export const analysisSchema = z.object({
  description: z.string().trim().max(1000).default(""),
  noteMarkdown: z.string().trim().min(1).max(100_000),
  findings: z.array(z.object({
    statement: z.string().trim().min(1).max(2000),
    source_id: sourceId.nullable().optional(),
  })).max(20).default([]),
  contradictions: z.array(z.object({
    explanation: z.string().trim().min(1).max(2000),
    source_ids: z.array(sourceId).max(8).default([]),
  })).max(12).default([]),
  openQuestions: z.array(z.object({
    text: z.string().trim().min(1).max(500),
  })).max(12).default([]),
  sourceTags: z.array(z.object({
    id: sourceId,
    tag: z.enum(["supports", "contradicts"]),
  })).max(40).default([]),
});

export type AnalysisDraft = z.infer<typeof analysisSchema>;

export function sanitizeAnalysis(draft: AnalysisDraft, knownSourceIds: ReadonlySet<string>) {
  const findings = draft.findings.flatMap((finding) => {
    if (finding.source_id && !knownSourceIds.has(finding.source_id)) return [];
    return [{ statement: finding.statement, source_id: finding.source_id ?? null }];
  });
  const contradictions = draft.contradictions.flatMap((item) => {
    const source_ids = [...new Set(item.source_ids.filter((id) => knownSourceIds.has(id)))];
    if (source_ids.length < 2) return [];
    return [{ explanation: item.explanation, source_ids }];
  });
  const sourceTags = draft.sourceTags.filter((tag) => knownSourceIds.has(tag.id));
  return {
    description: draft.description,
    noteMarkdown: draft.noteMarkdown,
    findings,
    contradictions,
    openQuestions: draft.openQuestions,
    sourceTags,
  };
}

export function spokenResearchSummary(input: {
  question: string;
  description?: string | null;
  findings: { statement: string }[];
  contradictions: { explanation: string }[];
  openQuestions: { text: string }[];
}) {
  return {
    question: input.question,
    description: input.description?.trim() || "",
    findingCount: input.findings.length,
    contradictionCount: input.contradictions.length,
    openQuestionCount: input.openQuestions.length,
    findings: input.findings.slice(0, 5).map((finding) => finding.statement),
    contradictions: input.contradictions.slice(0, 5).map((item) => item.explanation),
    openQuestions: input.openQuestions.slice(0, 5).map((item) => item.text),
  };
}

export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    description: { type: "string" },
    noteMarkdown: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { statement: { type: "string" }, source_id: { type: ["string", "null"] } },
        required: ["statement", "source_id"],
      },
    },
    contradictions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { explanation: { type: "string" }, source_ids: { type: "array", items: { type: "string" } } },
        required: ["explanation", "source_ids"],
      },
    },
    openQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
    sourceTags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" }, tag: { type: "string", enum: ["supports", "contradicts"] } },
        required: ["id", "tag"],
      },
    },
  },
  required: ["description", "noteMarkdown", "findings", "contradictions", "openQuestions", "sourceTags"],
} as const;
