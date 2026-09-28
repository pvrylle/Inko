import { describe, expect, it } from "vitest";
import { suggestStudyTools } from "./suggest-study-tools";

describe("suggestStudyTools", () => {
  it("suggests writing tools for an essay conclusion", () => {
    const answer = "When writing an essay about overcoming a personal challenge, your conclusion can explore how that experience shaped who you are today [2]. Additionally, the conclusion of a narrative essay should reflect on what changed.";
    expect(suggestStudyTools("Challenge my conclusion", answer, 2).map((tool) => tool.id)).toEqual([
      "note",
      "research",
      "canvas",
      "focus",
    ]);
  });

  it("suggests cards and research for a sourced explanation", () => {
    const answer = "Artificial intelligence can change how students practise. Reviews disagree on how strong the evidence is. Newer classroom studies are still small. A useful next step is to compare those results.";
    expect(suggestStudyTools("Research the effects of AI on education", answer, 4).map((tool) => tool.id)).toEqual([
      "note",
      "cards",
      "research",
      "canvas",
    ]);
  });

  it("suggests a quiz when the question asks for one", () => {
    const ids = suggestStudyTools("Quiz me on cell structure", "The nucleus holds DNA. Mitochondria release energy. The membrane controls what enters.", 0).map((tool) => tool.id);
    expect(ids).toContain("quiz");
    expect(ids).not.toContain("focus");
  });
});