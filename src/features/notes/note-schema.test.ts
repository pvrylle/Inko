import { buildNoteMarkdown, generatedNoteSchema } from "./note-schema";

describe("note generation schema", () => {
  const note = { title: "Mitosis", summary: "Cells divide in ordered stages.", keyPoints: ["DNA is copied first", "Cytokinesis splits the cell"], cleanedContent: "Mitosis produces two daughter cells." };

  it("validates and formats a portable Markdown note", () => {
    expect(generatedNoteSchema.parse(note)).toEqual(note);
    expect(buildNoteMarkdown(note)).toContain("# Mitosis");
    expect(buildNoteMarkdown(note)).toContain("- DNA is copied first");
  });

  it("rejects notes without enough key points", () => {
    expect(() => generatedNoteSchema.parse({ ...note, keyPoints: [] })).toThrow();
  });
});
