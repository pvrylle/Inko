import { describe, expect, it } from "vitest";
import { assertUpload } from "./file-guard";

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

describe("assertUpload", () => {
  it("rejects a non-allowlisted file", () => {
    const result = assertUpload({ name: "notes.exe", type: "application/octet-stream", size: 12 }, pdf);
    expect(result.ok).toBe(false);
  });

  it("rejects a pdf whose bytes are not a pdf", () => {
    const result = assertUpload({ name: "paper.pdf", type: "application/pdf", size: 12 }, new Uint8Array([1, 2, 3, 4]));
    expect(result).toEqual({ ok: false, error: "UNSUPPORTED_FILE" });
  });

  it("rejects path traversal in the file name", () => {
    const result = assertUpload({ name: "../secret.pdf", type: "application/pdf", size: 12 }, pdf);
    expect(result).toEqual({ ok: false, error: "INVALID_FILE_NAME" });
  });

  it("rejects files over 20 MB", () => {
    const result = assertUpload({ name: "paper.pdf", type: "application/pdf", size: 20 * 1024 * 1024 + 1 }, pdf);
    expect(result).toEqual({ ok: false, error: "FILE_TOO_LARGE" });
  });

  it("accepts a pdf with the magic header", () => {
    const result = assertUpload({ name: "paper.pdf", type: "application/pdf", size: 12 }, pdf);
    expect(result).toEqual({ ok: true, name: "paper.pdf", type: "pdf" });
  });
});
