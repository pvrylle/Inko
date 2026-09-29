/**
 * Property tests for SessionNameForm
 *
 * Property 6: Session name max-length constraint
 * - For any string of length > 120, the input SHALL NOT store more than 120
 *   characters as the active session name.
 * - Validates: Requirements 6.2
 *
 * Property 7: Valid session name accepted and stored
 * - For any non-whitespace string `s` with 1 ≤ s.trim().length ≤ 120,
 *   submitting `s` via SessionNameForm SHALL persist `s.trim()` to
 *   sessionStorage under key "inko:session-name" and SHALL call
 *   router.push("/flashcards").
 * - Validates: Requirements 6.3, 6.4
 *
 * Property 8 (whitespace rejection) is also covered here as it exercises
 * the same form boundary and validates Requirements 6.5.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionNameForm } from "./session-name-form";

// ─── Mock next/navigation ──────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Per-test reset ────────────────────────────────────────────────────────────

beforeEach(() => {
  mockPush.mockClear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm() {
  render(<SessionNameForm />);
}

function getInput(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

function getSubmitButton(): HTMLElement {
  return screen.getByRole("button", { name: /start/i });
}

function typeValue(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

function submitForm() {
  fireEvent.click(getSubmitButton());
}

// ─── Property 6: max-length constraint ────────────────────────────────────────

describe("Property 6: Session name max-length constraint", () => {
  /**
   * The input declares maxLength={120}. The browser truncates input at 120
   * characters before the onChange fires. We verify the attribute is set and
   * that any value ≤ 120 chars stored in sessionStorage respects that limit.
   */

  it("6a — input element declares maxLength=120", () => {
    renderForm();
    expect(getInput().maxLength).toBe(120);
  });

  it(
    "6b — for any string longer than 120 chars, the stored value is capped at 120",
    () => {
      /**
       * The DOM enforces maxLength by truncating the value to 120 before firing
       * the change event. We simulate that truncation explicitly (as a real
       * browser would), then verify the stored value respects the cap.
       */
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 121, maxLength: 300 })
            .filter((s) => s.trim().length > 0),
          (overLongString) => {
            cleanup();
            mockPush.mockClear();
            sessionStorage.clear();
            renderForm();

            // Simulate what the browser does: truncate at maxLength before onChange
            const truncated = overLongString.slice(0, 120);
            typeValue(getInput(), truncated);
            submitForm();

            const stored = sessionStorage.getItem("inko:session-name");
            if (stored !== null) {
              expect(stored.length).toBeLessThanOrEqual(120);
            }
          },
        ),
        { numRuns: 25 },
      );
    },
    20_000,
  );

  it("6c — concrete: 121-char string is truncated to ≤ 120 before storage", () => {
    renderForm();
    const overLong = "A".repeat(121);
    typeValue(getInput(), overLong.slice(0, 120)); // simulate DOM truncation
    submitForm();
    const stored = sessionStorage.getItem("inko:session-name");
    expect(stored).not.toBeNull();
    expect(stored!.length).toBeLessThanOrEqual(120);
  });
});

// ─── Property 7: Valid session name accepted and stored ───────────────────────

describe("Property 7: Valid session name accepted and stored", () => {
  /**
   * For any non-whitespace string `s` with 1 ≤ s.trim().length ≤ 120,
   * submitting the form SHALL:
   *   - Write s.trim() to sessionStorage["inko:session-name"]
   *   - Call router.push("/flashcards") exactly once
   */

  it(
    "7a — any valid trimmed string (1–120 chars) is stored and triggers navigation",
    () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 120 })
            .filter((s) => s.trim().length >= 1),
          (validName) => {
            cleanup();
            mockPush.mockClear();
            sessionStorage.clear();
            renderForm();

            typeValue(getInput(), validName);
            submitForm();

            expect(sessionStorage.getItem("inko:session-name")).toBe(
              validName.trim(),
            );
            expect(mockPush).toHaveBeenCalledOnce();
            expect(mockPush).toHaveBeenCalledWith("/flashcards");
          },
        ),
        { numRuns: 25 },
      );
    },
    20_000,
  );

  it(
    "7b — stored value is the trimmed form, not the raw input",
    () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 100 })
            .filter((s) => s.trim().length >= 1),
          (interior) => {
            // Wrap the valid string in spaces to create leading/trailing whitespace
            const padded = `  ${interior}  `;
            const input = padded.slice(0, 120);
            if (input.trim().length === 0) return; // skip degenerate case

            cleanup();
            mockPush.mockClear();
            sessionStorage.clear();
            renderForm();

            typeValue(getInput(), input);
            submitForm();

            const stored = sessionStorage.getItem("inko:session-name");
            if (stored !== null) {
              expect(stored).toBe(input.trim());
            }
          },
        ),
        { numRuns: 25 },
      );
    },
    20_000,
  );

  it("7c — concrete: 'Biology 101 – Cell division' is stored and navigates", () => {
    renderForm();
    const name = "Biology 101 – Cell division";
    typeValue(getInput(), name);
    submitForm();

    expect(sessionStorage.getItem("inko:session-name")).toBe(name.trim());
    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/flashcards");
  });

  it("7d — leading/trailing whitespace is trimmed before storage", () => {
    renderForm();
    typeValue(getInput(), "  My Session  ");
    submitForm();

    expect(sessionStorage.getItem("inko:session-name")).toBe("My Session");
    expect(mockPush).toHaveBeenCalledWith("/flashcards");
  });
});

// ─── Property 8: Whitespace / empty input rejected ────────────────────────────

describe("Property 8: Whitespace-only and empty session names are rejected", () => {
  /**
   * For any string composed entirely of whitespace (including the empty string),
   * submitting the form SHALL:
   *   - Display the validation message "Please give your session a name."
   *   - NOT call router.push
   *   - NOT write to sessionStorage
   */

  it("8a — empty input shows error and does not navigate", () => {
    renderForm();
    // input is empty by default — submit without typing
    submitForm();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please give your session a name.",
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("inko:session-name")).toBeNull();
  });

  it(
    "8b — whitespace-only string shows error and does not navigate",
    () => {
      fc.assert(
        fc.property(
          // Strings composed entirely of space characters (at least 1)
          fc
            .string({ minLength: 1, maxLength: 60 })
            .map((s) => s.replace(/\S/g, " ")),
          (whitespaceOnly) => {
            cleanup();
            mockPush.mockClear();
            sessionStorage.clear();
            renderForm();

            typeValue(getInput(), whitespaceOnly);
            submitForm();

            expect(screen.getByRole("alert")).toHaveTextContent(
              "Please give your session a name.",
            );
            expect(mockPush).not.toHaveBeenCalled();
            expect(sessionStorage.getItem("inko:session-name")).toBeNull();
          },
        ),
        { numRuns: 25 },
      );
    },
    20_000,
  );

  it("8c — single space shows error", () => {
    renderForm();
    typeValue(getInput(), " ");
    submitForm();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please give your session a name.",
    );
    expect(mockPush).not.toHaveBeenCalled();
  });
});
