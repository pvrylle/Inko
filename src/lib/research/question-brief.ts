import "server-only";
import { z } from "zod";
import { generateJson } from "@/lib/ai/generate";

const briefSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).default(""),
  noteMarkdown: z.string().trim().min(1).max(20_000),
  sources: z.array(z.object({
    key: z.string().trim().min(1).max(20),
    title: z.string().trim().min(1).max(200),
    url: z.string().trim().max(2000).nullable(),
    type: z.enum(["document", "url"]),
    tag: z.enum(["supports", "contradicts"]),
    meta: z.string().trim().max(200),
  })).min(3).max(6),
  findings: z.array(z.object({
    statement: z.string().trim().min(1).max(2000),
    sourceKey: z.string().trim().min(1).max(20),
  })).min(3).max(8),
  contradictions: z.array(z.object({
    explanation: z.string().trim().min(1).max(2000),
    sourceKeys: z.array(z.string().trim().min(1).max(20)).min(2).max(4),
  })).min(1).max(4),
  openQuestions: z.array(z.object({
    text: z.string().trim().min(1).max(500),
  })).min(2).max(6),
});

const briefJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "noteMarkdown", "sources", "findings", "contradictions", "openQuestions"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    noteMarkdown: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "title", "url", "type", "tag", "meta"],
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          url: { type: ["string", "null"] },
          type: { type: "string", enum: ["document", "url"] },
          tag: { type: "string", enum: ["supports", "contradicts"] },
          meta: { type: "string" },
        },
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "sourceKey"],
        properties: { statement: { type: "string" }, sourceKey: { type: "string" } },
      },
    },
    contradictions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["explanation", "sourceKeys"],
        properties: { explanation: { type: "string" }, sourceKeys: { type: "array", items: { type: "string" } } },
      },
    },
    openQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: { text: { type: "string" } },
      },
    },
  },
} as const;

export type QuestionBrief = z.infer<typeof briefSchema>;

export type ResearchBriefBundle = {
  session: {
    id: string;
    owner_id: string;
    question: string;
    title: string;
    description: string;
    status: "ready";
    created_at: string;
    updated_at: string;
  };
  sources: Array<{
    id: string;
    session_id: string;
    owner_id: string;
    title: string;
    url: string | null;
    type: "document" | "url";
    tag: "supports" | "contradicts";
    meta: string;
    created_at: string;
  }>;
  findings: Array<{
    id: string;
    session_id: string;
    owner_id: string;
    statement: string;
    source_id: string | null;
    created_at: string;
  }>;
  contradictions: Array<{
    id: string;
    session_id: string;
    owner_id: string;
    explanation: string;
    source_ids: string[];
    created_at: string;
  }>;
  openQuestions: Array<{
    id: string;
    session_id: string;
    owner_id: string;
    text: string;
    created_at: string;
  }>;
  note: {
    id: string;
    session_id: string;
    owner_id: string;
    content_markdown: string;
    updated_at: string;
  };
};

export function materializeBrief(
  ownerId: string,
  question: string,
  brief: QuestionBrief,
  sessionId = crypto.randomUUID(),
): ResearchBriefBundle {
  const now = new Date().toISOString();
  const keys = new Map<string, string>();
  const sources = brief.sources.map((source) => {
    const id = crypto.randomUUID();
    keys.set(source.key, id);
    return {
      id,
      session_id: sessionId,
      owner_id: ownerId,
      title: source.title,
      url: source.url,
      type: source.type,
      tag: source.tag,
      meta: source.meta,
      created_at: now,
    };
  });
  return {
    session: {
      id: sessionId,
      owner_id: ownerId,
      question,
      title: brief.title,
      description: brief.description,
      status: "ready",
      created_at: now,
      updated_at: now,
    },
    sources,
    findings: brief.findings.map((finding) => ({
      id: crypto.randomUUID(),
      session_id: sessionId,
      owner_id: ownerId,
      statement: finding.statement,
      source_id: keys.get(finding.sourceKey) ?? null,
      created_at: now,
    })),
    contradictions: brief.contradictions.map((item) => ({
      id: crypto.randomUUID(),
      session_id: sessionId,
      owner_id: ownerId,
      explanation: item.explanation,
      source_ids: item.sourceKeys.map((key) => keys.get(key)).filter((id): id is string => Boolean(id)),
    })).filter((item) => item.source_ids.length >= 2).map((item) => ({ ...item, created_at: now })),
    openQuestions: brief.openQuestions.map((item) => ({
      id: crypto.randomUUID(),
      session_id: sessionId,
      owner_id: ownerId,
      text: item.text,
      created_at: now,
    })),
    note: {
      id: crypto.randomUUID(),
      session_id: sessionId,
      owner_id: ownerId,
      content_markdown: brief.noteMarkdown,
      updated_at: now,
    },
  };
}

export function fallbackQuestionBrief(question: string): QuestionBrief {
  const title = question.length > 72 ? `${question.slice(0, 69).trim()}…` : question;
  return {
    title,
    description: "A first-pass brief from your question. Add sources or talk with Inko when you want to go deeper.",
    noteMarkdown: `# ${title}\n\n## Question\n${question}\n\n## Working notes\nSeparate what is already established from what still needs a primary source. Use the starter findings as prompts, then replace them with evidence you trust.\n\n## Next steps\n- Check a background overview\n- Add one supporting source\n- Keep one counterpoint visible`,
    sources: [
      { key: "s1", title: "Core background", url: null, type: "document", tag: "supports", meta: "Overview · starter" },
      { key: "s2", title: "Supporting evidence", url: null, type: "document", tag: "supports", meta: "Evidence · starter" },
      { key: "s3", title: "Counterpoint", url: null, type: "document", tag: "contradicts", meta: "Critique · starter" },
    ],
    findings: [
      { statement: `The question “${title}” needs evidence from more than one perspective.`, sourceKey: "s1" },
      { statement: "A useful first step is to separate established facts from open claims.", sourceKey: "s2" },
      { statement: "A competing view should stay visible so the brief does not become one-sided.", sourceKey: "s3" },
    ],
    contradictions: [
      { explanation: "Starter sources disagree on how strong the current evidence is.", sourceKeys: ["s2", "s3"] },
    ],
    openQuestions: [
      { text: "What would count as decisive evidence for this question?" },
      { text: "Which assumptions need a primary source before you can trust them?" },
    ],
  };
}

export async function generateQuestionBrief(question: string): Promise<QuestionBrief> {
  try {
    return briefSchema.parse(await generateJson(
      `You are Inko, a careful research companion. Build a first-pass research brief for this student question.

Rules:
- Each finding is one sentence a student could defend or challenge.
- Give each source a short key like s1. Every finding sourceKey and every contradiction source key must be one of those keys.
- Tag a source "supports" when it backs the question, or "contradicts" when it pushes the other way.
- Use well-established public knowledge only. Do not invent paywalled quotes, paper titles, or DOIs. If a URL is not confidently real, set url to null and type to document.
- Each contradiction names the tension between two or more of those sources in one or two sentences.
- Open questions are gaps the student could claim: what is still unproven, local, or missing a primary source.
- noteMarkdown is short study notes with headings, not an essay.

Question:
${question}`,
      briefJsonSchema as unknown as Record<string, unknown>,
    ));
  } catch {
    return fallbackQuestionBrief(question);
  }
}
