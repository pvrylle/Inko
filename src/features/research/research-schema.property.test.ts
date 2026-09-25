/**
 * Property tests for research question validation — `researchQuestionSchema`
 *
 * Property 12: Research question length validation
 * - For any string `q` with 10 ≤ q.length ≤ 500, the schema SHALL validate successfully.
 * - For any string `q` with q.length < 10, the schema SHALL reject.
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

// ─── Property 12a: Valid range (10–500) always accepted ───────────────────────

describe("Property 12: Research question length validation", () => {
  it("12a — any string with length in [10, 500] is accepted", () => {
    /**
     * For any string whose length is between 10 and 500 characters (inclusive),
     * researchQuestionSchema SHALL parse successfully.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }),
        (q) => {
          expect(isValid(q)).toBe(true);
        },
      ),
    );
  });

  // ─── Property 12b: Below minimum (< 10) always rejected ─────────────────────

  it("12b — any string with length < 10 is rejected", () => {
    /**
     * For any string shorter than 10 characters (including the empty string),
     * researchQuestionSchema SHALL reject.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 9 }),
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

  it('concrete — "1234567890" (exactly 10 chars) is accepted', () => {
    expect(isValid("1234567890")).toBe(true);
  });

  it('concrete — "123456789" (9 chars) is rejected', () => {
    expect(isValid("123456789")).toBe(false);
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
