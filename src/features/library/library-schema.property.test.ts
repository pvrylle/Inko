/**
 * Property tests for class name validation — `classNameSchema`
 *
 * Property 15: Class name length constraint
 * - For any string `n` with 1 ≤ n.length ≤ 80, the schema SHALL validate successfully.
 * - For any empty string (n.length === 0), the schema SHALL reject.
 * - For any string `n` with n.length > 80, the schema SHALL reject.
 *
 * Validates: Requirements 9.4
 */

import * as fc from "fast-check";
import { classNameSchema } from "./library-schema";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the Zod schema accepts the input without throwing. */
function isValid(n: string): boolean {
  const result = classNameSchema.safeParse(n);
  return result.success;
}

// ─── Property 15: Class name length constraint ────────────────────────────────

describe("Property 15: Class name length constraint", () => {
  // ─── Property 15a: Valid range (1–80) always accepted ───────────────────────

  it("15a — any string with length in [1, 80] is accepted", () => {
    /**
     * For any string whose length is between 1 and 80 characters (inclusive),
     * classNameSchema SHALL parse successfully.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 80 }),
        (n) => {
          expect(isValid(n)).toBe(true);
        },
      ),
    );
  });

  // ─── Property 15b: Empty string always rejected ──────────────────────────────

  it("15b — empty string is rejected", () => {
    /**
     * The empty string (length 0) SHALL be rejected by classNameSchema.
     * This is tested as a concrete example since there is exactly one empty string.
     */
    expect(isValid("")).toBe(false);
  });

  // ─── Property 15c: Above maximum (> 80) always rejected ─────────────────────

  it("15c — any string with length > 80 is rejected", () => {
    /**
     * For any string longer than 80 characters, classNameSchema SHALL reject.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 81, maxLength: 200 }),
        (n) => {
          expect(isValid(n)).toBe(false);
        },
      ),
    );
  });

  // ─── Concrete examples from Requirement 9.4 ──────────────────────────────────

  it('concrete — single character "A" (exactly 1 char) is accepted', () => {
    expect(isValid("A")).toBe(true);
  });

  it('concrete — 80-character string is accepted', () => {
    const n = "a".repeat(80);
    expect(isValid(n)).toBe(true);
  });

  it('concrete — 81-character string is rejected', () => {
    const n = "a".repeat(81);
    expect(isValid(n)).toBe(false);
  });

  it('concrete — typical class name "Biology 101" is accepted', () => {
    expect(isValid("Biology 101")).toBe(true);
  });
});
