import { upsertDebate, type SavedDebate } from "./debate-archive";

describe("upsertDebate", () => {
  const base = {
    claim: "Disgust is a behavioral immune system.",
    mode: "debate" as const,
    researchSessionId: "research-1",
    researchQuestion: "Why did disgust evolve?",
    chatSessionId: "chat-1",
    chatTitle: "Eww",
    turns: [],
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
  };

  it("keeps a debate next to its research and chat, newest first", () => {
    const older: SavedDebate = { ...base, id: "older", updatedAt: "2026-09-29T00:00:00.000Z" };
    const newer: SavedDebate = { ...base, id: "newer", updatedAt: "2026-09-30T01:00:00.000Z", turns: [{ role: "student", text: "I think it is innate." }] };
    const next = upsertDebate([older], newer);
    expect(next.map((item) => item.id)).toEqual(["newer", "older"]);
    expect(next[0]?.researchSessionId).toBe("research-1");
    expect(next[0]?.chatTitle).toBe("Eww");
  });

  it("replaces the same debate instead of duplicating it", () => {
    const first: SavedDebate = { ...base, id: "same", turns: [] };
    const updated: SavedDebate = { ...base, id: "same", turns: [{ role: "inko", text: "What about culture?" }] };
    expect(upsertDebate([first], updated)).toHaveLength(1);
    expect(upsertDebate([first], updated)[0]?.turns).toHaveLength(1);
  });
});
