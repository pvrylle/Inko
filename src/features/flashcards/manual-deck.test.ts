import { deckNoteMarkdown, filledDraftCards, starterDraftCards } from "./manual-deck";

describe("manual flashcard drafts", () => {
  it("starts with three empty term and definition rows", () => {
    const cards = starterDraftCards();
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.front === "" && card.back === "")).toBe(true);
  });

  it("keeps only rows that have both a term and a definition", () => {
    expect(filledDraftCards([
      { id: "1", front: "Mitosis", back: "Division of body cells" },
      { id: "2", front: "  ", back: "Missing term" },
      { id: "3", front: "Meiosis", back: "" },
    ])).toEqual([{ front: "Mitosis", back: "Division of body cells" }]);
  });

  it("writes the deck as markdown the note can store", () => {
    const markdown = deckNoteMarkdown("Cell division", [{ front: "Mitosis", back: "Body cells" }]);
    expect(markdown).toContain("# Cell division");
    expect(markdown).toContain("1. Mitosis");
    expect(markdown).toContain("Body cells");
  });
});
