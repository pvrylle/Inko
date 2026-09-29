import { buildDebateEvidence } from "./debate-evidence";

describe("buildDebateEvidence", () => {
  it("puts sources first and attaches a finding to its source title", () => {
    const evidence = buildDebateEvidence({
      sources: [
        { id: "s1", title: "Core background", tag: "supports", meta: "Article" },
        { id: "s2", title: "Cultural variation", tag: "contradicts" },
      ],
      findings: [{ statement: "Disgust helps people avoid disease.", source_id: "s1" }],
      contradictions: [{ explanation: "Culture changes which triggers count as disgusting." }],
    });
    expect(evidence.map((item) => item.kind)).toEqual(["source", "source", "finding", "contradiction"]);
    expect(evidence[0]).toMatchObject({ text: "Core background — Article", tag: "supports" });
    expect(evidence[1]?.tag).toBe("contradicts");
    expect(evidence[2]?.text).toContain("source: Core background");
  });

  it("drops blank titles and caps the pack at 24 items", () => {
    const sources = Array.from({ length: 20 }, (_, index) => ({ id: `s${index}`, title: index === 0 ? "  " : `Source ${index}`, tag: "supports" }));
    const evidence = buildDebateEvidence({ sources, findings: [], contradictions: [] });
    expect(evidence.every((item) => item.text.trim().length > 0)).toBe(true);
    expect(evidence.length).toBeLessThanOrEqual(12);
  });
});