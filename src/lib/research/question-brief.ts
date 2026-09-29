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

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeQuestionBrief(raw: unknown, question: string): QuestionBrief {
  const fallback = fallbackQuestionBrief(question);
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const sourceItems = Array.isArray(data.sources) ? data.sources : [];
  const seen = new Set<string>();
  const sources = sourceItems.slice(0, 6).map((item, index) => {
    const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const urlText = clip(source.url, 2000);
    const url = /^https?:\/\//i.test(urlText) ? urlText : null;
    const tag = source.tag === "contradicts" ? "contradicts" as const : "supports" as const;
    let key = clip(source.key, 20) || `s${index + 1}`;
    if (seen.has(key)) key = `s${index + 1}`;
    seen.add(key);
    return {
      key,
      title: clip(source.title, 200) || `Source ${index + 1}`,
      url,
      type: source.type === "url" || source.type === "document" ? source.type : url ? "url" as const : "document" as const,
      tag,
      meta: clip(source.meta, 200) || (tag === "contradicts" ? "Counterpoint" : "Evidence"),
    };
  }).filter((source) => source.title.length > 0);
  const mergedSources = (sources.length >= 3 ? sources : [...sources, ...fallback.sources]).slice(0, 6);
  const keys = mergedSources.map((source) => source.key);

  const findingItems = Array.isArray(data.findings) ? data.findings : [];
  const findings = findingItems.slice(0, 8).map((item, index) => {
    const finding = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const sourceKey = clip(finding.sourceKey ?? finding.source, 20);
    return {
      statement: clip(finding.statement ?? finding.text ?? finding.claim, 2000),
      sourceKey: keys.includes(sourceKey) ? sourceKey : keys[index % keys.length] ?? keys[0],
    };
  }).filter((finding) => finding.statement.length > 0);
  const mergedFindings = (findings.length >= 3 ? findings : [...findings, ...fallback.findings]).slice(0, 8);

  const contradictionItems = Array.isArray(data.contradictions) ? data.contradictions : [];
  const contradictions = contradictionItems.slice(0, 4).map((item) => {
    const contradiction = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const rawKeys = Array.isArray(contradiction.sourceKeys) ? contradiction.sourceKeys : [];
    const sourceKeys = rawKeys.map((key) => clip(key, 20)).filter((key) => keys.includes(key)).slice(0, 4);
    return {
      explanation: clip(contradiction.explanation ?? contradiction.text, 2000),
      sourceKeys: sourceKeys.length >= 2 ? sourceKeys : keys.slice(0, 2),
    };
  }).filter((item) => item.explanation.length > 0 && item.sourceKeys.length >= 2);
  const mergedContradictions = contradictions.length >= 1
    ? contradictions
    : fallback.contradictions.map((item) => ({ explanation: item.explanation, sourceKeys: keys.slice(0, 2) }));

  const questionItems = Array.isArray(data.openQuestions) ? data.openQuestions : [];
  const openQuestions = questionItems.slice(0, 6).map((item) => {
    if (typeof item === "string") return { text: clip(item, 500) };
    const questionItem = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { text: clip(questionItem.text ?? questionItem.question, 500) };
  }).filter((item) => item.text.length > 0);
  const mergedQuestions = (openQuestions.length >= 2 ? openQuestions : [...openQuestions, ...fallback.openQuestions]).slice(0, 6);

  return {
    title: clip(data.title, 160) || fallback.title,
    description: clip(data.description, 1000),
    noteMarkdown: clip(data.noteMarkdown ?? data.note, 20_000) || fallback.noteMarkdown,
    sources: mergedSources,
    findings: mergedFindings,
    contradictions: mergedContradictions,
    openQuestions: mergedQuestions,
  };
}

export async function generateQuestionBrief(question: string): Promise<QuestionBrief> {
  try {
    const raw = await generateJson(
      `You are Inko, a study tutor. Teach this question, then organize the lesson as a research brief.

Rules:
- description is two or three sentences that explain the idea in plain language.
- Each finding is one or two sentences a student could learn from and later defend. Say what is true and why it matters.
- Give each source a short key like s1. Every finding sourceKey and every contradiction source key must be one of those keys.
- Tag a source "supports" when it backs the question, or "contradicts" when it pushes the other way.
- Use well-established public knowledge only. Do not invent paywalled quotes, paper titles, or DOIs. If a URL is not confidently real, set url to null and type to document.
- Each contradiction explains the disagreement in plain language, in one or two sentences.
- Open questions are things a curious student would still ask.
- noteMarkdown is a short lesson with these headings: The idea, Why it matters, An example, What is still debated. Write complete sentences that teach. Do not write an outline or a slogan list.
- Fill sources, findings, contradictions, open questions, and notes. Do not leave a section empty.

Question:
${question}`,
      briefJsonSchema as unknown as Record<string, unknown>,
    );
    return briefSchema.parse(normalizeQuestionBrief(raw, question));
  } catch {
    return fallbackQuestionBrief(question);
  }
}
