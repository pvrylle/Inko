/**
 * Property tests for FileUploadZone component
 *
 * Property 16: Upload failure surfaces file name and reason
 * - For any non-null `uploadError` string, FileUploadZone SHALL display the
 *   error inside a `role="alert"` banner.
 * - Validates: Requirements 9.5
 */

import * as fc from "fast-check";
import { render, within } from "@testing-library/react";
import { FileUploadZone } from "./file-upload-zone";
import type { LibraryClass } from "./library-schema";

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Short hex id — fast to generate, collision-unlikely for test purposes. */
const arbId = fc.hexaString({ minLength: 8, maxLength: 8 });

/** A valid LibraryClass with a printable name. */
const arbLibraryClass: fc.Arbitrary<LibraryClass> = fc.record({
  id: arbId,
  owner_id: arbId,
  name: fc
    .stringOf(
      fc.mapToConstant(
        { num: 26, build: (n) => String.fromCharCode(65 + n) }, // A-Z
        { num: 26, build: (n) => String.fromCharCode(97 + n) }, // a-z
        { num: 10, build: (n) => String.fromCharCode(48 + n) }, // 0-9
        { num: 1,  build: () => " " },
      ),
      { minLength: 1, maxLength: 30 },
    )
    .map((s) => s.trim() || "Class"),
  created_at: fc.constant("2024-01-01T00:00:00Z"),
});

/**
 * A non-empty, non-whitespace-only error string with no leading or trailing
 * whitespace (matching real-world error message patterns).
 * Includes typical "Failed to upload 'file.pdf': Storage quota exceeded" patterns
 * as well as arbitrary printable strings.
 */
const arbErrorString: fc.Arbitrary<string> = fc.oneof(
  // Arbitrary non-empty printable strings without leading/trailing whitespace
  fc.string({ minLength: 1, maxLength: 200 }).filter(
    (s) => s.trim().length > 0 && s === s.trim(),
  ),
  // Realistic "filename: reason" format
  fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0 && s === s.trim()),
      fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0 && s === s.trim()),
    )
    .map(([name, reason]) => `Failed to upload '${name}': ${reason}`),
);

// ─── Property 16: Upload failure surfaces file name and reason ────────────────

describe("Property 16: Upload failure surfaces file name and reason", () => {
  it("16a — any non-null uploadError string appears inside the alert banner", { timeout: 30000 }, () => {
    /**
     * For any non-empty error string, FileUploadZone SHALL render it inside
     * an element with role="alert".
     *
     * Each property iteration renders into its own container so multiple
     * fast-check runs never accumulate stale DOM nodes in the same document.
     *
     * Validates: Requirements 9.5
     */
    fc.assert(
      fc.property(
        fc.array(arbLibraryClass, { minLength: 1, maxLength: 4 }),
        arbErrorString,
        (classes, errorMessage) => {
          // Render into an isolated container to avoid cross-iteration DOM leaks
          const container = document.createElement("div");
          document.body.appendChild(container);

          const { unmount } = render(
            <FileUploadZone
              classes={classes}
              uploadFile={async () => {}}
              uploadError={errorMessage}
            />,
            { container },
          );

          // Query within the specific container to avoid picking up other renders
          const view = within(container);
          const alert = view.getByRole("alert");
          expect(alert).toBeInTheDocument();
          expect(alert).toHaveTextContent(errorMessage, { normalizeWhitespace: false });

          unmount();
          document.body.removeChild(container);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("16b — when uploadError is null, no alert banner is rendered", () => {
    /**
     * When no upload error exists (null), the error banner SHALL NOT appear.
     *
     * Validates: Requirements 9.5 (by contrast)
     */
    fc.assert(
      fc.property(
        fc.array(arbLibraryClass, { minLength: 1, maxLength: 4 }),
        (classes) => {
          const container = document.createElement("div");
          document.body.appendChild(container);

          const { unmount } = render(
            <FileUploadZone
              classes={classes}
              uploadFile={async () => {}}
              uploadError={null}
            />,
            { container },
          );

          const view = within(container);
          expect(view.queryByRole("alert")).not.toBeInTheDocument();

          unmount();
          document.body.removeChild(container);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('concrete — error message "Failed to upload \'notes.pdf\': Storage quota exceeded" appears in alert', () => {
    const classes: LibraryClass[] = [
      { id: "c1", owner_id: "owner-1", name: "Biology 101", created_at: "2024-01-01T00:00:00Z" },
    ];
    const errorMessage = "Failed to upload 'notes.pdf': Storage quota exceeded";

    const container = document.createElement("div");
    document.body.appendChild(container);

    const { unmount } = render(
      <FileUploadZone
        classes={classes}
        uploadFile={async () => {}}
        uploadError={errorMessage}
      />,
      { container },
    );

    const alert = within(container).getByRole("alert");
    expect(alert).toHaveTextContent("Failed to upload 'notes.pdf': Storage quota exceeded");

    unmount();
    document.body.removeChild(container);
  });

  it("concrete — error appears even when no classes exist (upload-zone shows no-class prompt)", () => {
    const errorMessage = "Failed to upload 'essay.docx': File type not allowed";

    const container = document.createElement("div");
    document.body.appendChild(container);

    const { unmount } = render(
      <FileUploadZone
        classes={[]}
        uploadFile={async () => {}}
        uploadError={errorMessage}
      />,
      { container },
    );

    const alert = within(container).getByRole("alert");
    expect(alert).toHaveTextContent(errorMessage);

    unmount();
    document.body.removeChild(container);
  });
});
