import { researchTutorDetail } from "./research-tutor-brief";

describe("researchTutorDetail", () => {
  it("includes the question, open tab, finding, and gap", () => {
    const detail = researchTutorDetail({
      question: "Does retrieval practice beat rereading?",
      tab: "findings",
      finding: "Practice tests improve delayed recall.",
      gap: "Few studies compare equal study time.",
    });
    expect(detail).toContain("Research question: Does retrieval practice beat rereading?");
    expect(detail).toContain("Open tab: Findings");
    expect(detail).toContain("First finding: Practice tests improve delayed recall.");
    expect(detail).toContain("First gap: Few studies compare equal study time.");
    expect(detail.length).toBeLessThanOrEqual(2000);
  });

  it("omits empty finding and gap lines", () => {
    const detail = researchTutorDetail({ question: "What is spaced practice?", tab: "overview", finding: "  ", gap: null });
    expect(detail).not.toContain("First finding");
    expect(detail).not.toContain("First gap");
    expect(detail).toContain("Open tab: Overview");
  });
});
