import type { ResearchTab } from "./use-research";

const TAB_LABEL: Record<ResearchTab, string> = {
  overview: "Overview",
  sources: "Sources",
  findings: "Findings",
  gaps: "Gaps",
  contradictions: "Contradictions",
  canvas: "Canvas",
  notes: "Notes",
  "open-questions": "Open Questions",
};

/** Context sent with chat requests while a research investigation is open. */
export function researchTutorDetail(input: {
  question: string;
  tab: ResearchTab;
  finding?: string | null;
  gap?: string | null;
}): string {
  const lines = [
    `Research question: ${input.question.trim()}`,
    `Open tab: ${TAB_LABEL[input.tab]}`,
  ];
  const finding = input.finding?.trim();
  const gap = input.gap?.trim();
  if (finding) lines.push(`First finding: ${finding}`);
  if (gap) lines.push(`First gap: ${gap}`);
  lines.push("Tutor the student on this investigation. Keep the reply short: explain the open tab, point at a gap, or ask one follow-up.");
  return lines.join("\n").slice(0, 2000);
}
