import { describe, expect, it } from "vitest";
import { analysisSchema, sanitizeAnalysis, spokenResearchSummary } from "./analysis";

const known = new Set(["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]);

describe("sanitizeAnalysis", () => {
  it("keeps findings and contradictions only when every source id belongs to the session", () => {
    const draft = analysisSchema.parse({
      description: "A short comparison.",
      noteMarkdown: "# Notes\n\nOnly the known sources.",
      findings: [
        { statement: "Known finding", source_id: "11111111-1111-4111-8111-111111111111" },
        { statement: "Foreign finding", source_id: "99999999-9999-4999-8999-999999999999" },
      ],
      contradictions: [
        { explanation: "Real tension", source_ids: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"] },
        { explanation: "Smuggled pair", source_ids: ["11111111-1111-4111-8111-111111111111", "99999999-9999-4999-8999-999999999999"] },
      ],
      openQuestions: [{ text: "What is still unresolved?" }],
      sourceTags: [
        { id: "11111111-1111-4111-8111-111111111111", tag: "supports" },
        { id: "99999999-9999-4999-8999-999999999999", tag: "contradicts" },
      ],
    });

    const clean = sanitizeAnalysis(draft, known);
    expect(clean.findings.map((finding) => finding.source_id)).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(clean.contradictions).toHaveLength(1);
    expect(clean.sourceTags.map((tag) => tag.id)).toEqual(["11111111-1111-4111-8111-111111111111"]);
  });
});

describe("spokenResearchSummary", () => {
  it("omits extracted source text", () => {
    const summary = spokenResearchSummary({
      question: "Does sleep help memory?",
      description: "The sources disagree on duration.",
      findings: [{ statement: "Sleep supports consolidation." }],
      contradictions: [{ explanation: "One source says naps are enough." }],
      openQuestions: [{ text: "How long is enough?" }],
    });
    expect(summary).not.toHaveProperty("extracted_text");
    expect(JSON.stringify(summary)).not.toContain("storage_path");
    expect(summary.findings).toEqual(["Sleep supports consolidation."]);
  });
});
