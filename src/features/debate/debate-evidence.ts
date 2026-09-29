export type DebateEvidence = {
  kind: "source" | "finding" | "contradiction";
  text: string;
  tag?: "supports" | "contradicts";
};

type SourceInput = { id: string; title: string; tag?: string; meta?: string | null };
type FindingInput = { statement: string; source_id?: string | null };
type ContradictionInput = { explanation: string };

function clip(text: string) {
  return text.trim().slice(0, 500);
}

/** The research pack sent with every debate turn. Sources come first. */
export function buildDebateEvidence(input: {
  sources: SourceInput[];
  findings: FindingInput[];
  contradictions: ContradictionInput[];
}): DebateEvidence[] {
  const sources = input.sources.flatMap((source) => {
    const text = clip([source.title, source.meta?.trim()].filter(Boolean).join(" — "));
    if (!text) return [];
    const tag = source.tag === "supports" || source.tag === "contradicts" ? source.tag : undefined;
    return [{ kind: "source" as const, text, ...(tag ? { tag } : {}) }];
  }).slice(0, 12);

  const findings = input.findings.flatMap((finding) => {
    const source = input.sources.find((item) => item.id === finding.source_id);
    const text = clip(source ? `${finding.statement} (source: ${source.title})` : finding.statement);
    return text ? [{ kind: "finding" as const, text }] : [];
  }).slice(0, 8);

  const contradictions = input.contradictions.flatMap((item) => {
    const text = clip(item.explanation);
    return text ? [{ kind: "contradiction" as const, text }] : [];
  }).slice(0, 4);

  return [...sources, ...findings, ...contradictions].slice(0, 24);
}
