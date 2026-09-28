/**
 * Property tests for research question validation — `researchQuestionSchema`
 *
 * Property 12: Research question length validation
 * - For any string `q` with 2 ≤ q.length ≤ 500, the schema SHALL validate successfully.
 * - For any string `q` with q.length < 2, the schema SHALL reject.
 * - For any string `q` with q.length > 500, the schema SHALL reject.
 *
 * Validates: Requirements 8.10, 8.12
 */

import * as fc from "fast-check";
import { researchQuestionSchema } from "./research-schema";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the Zod schema accepts the input without throwing. */
function isValid(q: string): boolean {
  const result = researchQuestionSchema.safeParse(q);
  return result.success;
}

// ─── Property 12a: Valid range (2–500) always accepted ───────────────────────

describe("Property 12: Research question length validation", () => {
  it("12a — any string with length in [2, 500] is accepted", () => {
    /**
     * For any string whose length is between 2 and 500 characters (inclusive),
     * researchQuestionSchema SHALL parse successfully.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 500 }),
        (q) => {
          expect(isValid(q)).toBe(true);
        },
      ),
    );
  });

  // ─── Property 12b: Below minimum (< 2) always rejected ─────────────────────

  it("12b — any string with length < 2 is rejected", () => {
    /**
     * For any string shorter than 2 characters (including the empty string),
     * researchQuestionSchema SHALL reject.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1 }),
        (q) => {
          expect(isValid(q)).toBe(false);
        },
      ),
    );
  });

  // ─── Property 12c: Above maximum (> 500) always rejected ────────────────────

  it("12c — any string with length > 500 is rejected", () => {
    /**
     * For any string longer than 500 characters, researchQuestionSchema SHALL reject.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 501, maxLength: 1000 }),
        (q) => {
          expect(isValid(q)).toBe(false);
        },
      ),
    );
  });

  // ─── Concrete examples from Requirements 8.10, 8.12 ─────────────────────────

  it("concrete — empty string is rejected", () => {
    expect(isValid("")).toBe(false);
  });

  it('concrete — "AI" (exactly 2 chars) is accepted', () => {
    expect(isValid("AI")).toBe(true);
  });

  it('concrete — "A" (1 char) is rejected', () => {
    expect(isValid("A")).toBe(false);
  });

  it("concrete — 500-character string is accepted", () => {
    const q = "a".repeat(500);
    expect(isValid(q)).toBe(true);
  });

  it("concrete — 501-character string is rejected", () => {
    const q = "a".repeat(501);
    expect(isValid(q)).toBe(false);
  });
});
