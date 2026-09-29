import { concatBase64Pcm, splitAnnaSpeakChunks } from "./anna-tts";

describe("splitAnnaSpeakChunks", () => {
  it("keeps a short line in one clip", () => {
    expect(splitAnnaSpeakChunks("Hello there.")).toEqual(["Hello there."]);
  });

  it("splits a long answer on a sentence boundary", () => {
    const first = `${"Learning is fun. ".repeat(80)}Done.`;
    const chunks = splitAnnaSpeakChunks(first, 80);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ").replace(/\s+/g, " ").trim().startsWith("Learning is fun.")).toBe(true);
    expect(chunks.every((chunk) => chunk.length <= 80)).toBe(true);
  });

  it("keeps every sentence when splitting a full reply", () => {
    const text = "First point is clear. Second point follows. Third point wraps it up.";
    const chunks = splitAnnaSpeakChunks(text, 40);
    expect(chunks.join(" ")).toBe(text);
  });
});

describe("concatBase64Pcm", () => {
  it("joins PCM clips in order", () => {
    const a = Buffer.from([1, 2]).toString("base64");
    const b = Buffer.from([3, 4]).toString("base64");
    expect(Buffer.from(concatBase64Pcm([a, b]), "base64")).toEqual(Buffer.from([1, 2, 3, 4]));
  });
});
