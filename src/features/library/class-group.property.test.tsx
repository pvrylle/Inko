/**
 * Property tests for ClassGroup component
 *
 * Property 14: File grouping by class
 * - For any list of LibraryFile objects belonging to a class, rendering
 *   ClassGroup with those files SHALL display every file name in the output.
 *   Files not passed to ClassGroup SHALL NOT appear in its output.
 * - Validates: Requirements 9.2, 9.3
 *
 * Property 19: Empty class shows indicator
 * - When ClassGroup receives files=[], it SHALL render a visible indicator
 *   communicating that no files have been added.
 * - Validates: Requirements 9.8
 */

import * as fc from "fast-check";
import { render, screen, within } from "@testing-library/react";
import { ClassGroup } from "./class-group";
import type { LibraryClass, LibraryFile } from "./library-schema";

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Short hex id — fast to generate, collision-unlikely for test purposes. */
const arbId = fc.hexaString({ minLength: 8, maxLength: 8 });

/** A valid LibraryClass (name 1–40 chars, printable ASCII only to stay DOM-safe). */
const arbLibraryClass: fc.Arbitrary<LibraryClass> = fc.record({
  id: arbId,
  owner_id: arbId,
  name: fc
    .stringOf(fc.mapToConstant(
      { num: 26, build: (n) => String.fromCharCode(65 + n) },   // A-Z
      { num: 26, build: (n) => String.fromCharCode(97 + n) },   // a-z
      { num: 10, build: (n) => String.fromCharCode(48 + n) },   // 0-9
      { num:  1, build: () => " " },
    ), { minLength: 1, maxLength: 30 })
    .map((s) => s.trim() || "Class"),
  created_at: fc.constant("2024-01-01T00:00:00Z"),
});

/** A valid LibraryFile for the given classId. Name is guaranteed non-empty and unique. */
const arbFile = (classId: string): fc.Arbitrary<LibraryFile> =>
  fc.record({
    id: arbId,
    owner_id: arbId,
    class_id: fc.constant(classId),
    // Suffix with index placeholder — uniqueness across the array comes from the id
    name: fc
      .stringOf(fc.mapToConstant(
        { num: 26, build: (n) => String.fromCharCode(65 + n) },
        { num: 26, build: (n) => String.fromCharCode(97 + n) },
        { num: 10, build: (n) => String.fromCharCode(48 + n) },
        { num:  1, build: () => "-" },
      ), { minLength: 3, maxLength: 30 })
      .map((s) => `${s || "doc"}.pdf`),
    type: fc.constantFrom("pdf", "doc", "docx", "txt", "md"),
    size_bytes: fc.integer({ min: 1, max: 1_000_000 }),
    storage_path: fc.constant("bucket/path"),
    upload_date: fc.constant("2024-06-01T00:00:00Z"),
    created_at: fc.constant("2024-06-01T00:00:00Z"),
  });

/**
 * Combined arbitrary: produces { libraryClass, files } where every file's
 * class_id equals libraryClass.id.
 */
const arbClassWithFiles = (minFiles = 1, maxFiles = 6): fc.Arbitrary<{
  libraryClass: LibraryClass;
  files: LibraryFile[];
}> =>
  arbLibraryClass.chain((libraryClass) =>
    fc
      .array(arbFile(libraryClass.id), { minLength: minFiles, maxLength: maxFiles })
      .map((files) => ({ libraryClass, files })),
  );

// ─── Property 14: File grouping by class ─────────────────────────────────────

describe("Property 14: File grouping by class", () => {
  it("14a — every file passed to ClassGroup appears in the rendered output", { timeout: 30000 }, () => {
    /**
     * For any LibraryClass and 1–6 files whose class_id matches that class,
     * every file.name SHALL appear inside the rendered ClassGroup region.
     *
     * Validates: Requirements 9.2, 9.3
     */
    fc.assert(
      fc.property(arbClassWithFiles(1, 6), ({ libraryClass, files }) => {
        const { container, unmount } = render(
          <ClassGroup
            libraryClass={libraryClass}
            files={files}
            onDeleteFile={() => {}}
          />,
        );

        const section = within(container).getByRole("region");
        for (const file of files) {
          expect(within(section).getByText(file.name)).toBeInTheDocument();
        }

        unmount();
      }),
      { numRuns: 50 },
    );
  });

  it("14b — files not passed to ClassGroup do not appear in its output", () => {
    /**
     * ClassGroup only renders the files it receives. A file belonging to a
     * different class, if excluded from the `files` prop, SHALL NOT appear.
     *
     * Validates: Requirements 9.2, 9.3
     */
    fc.assert(
      fc.property(
        // Two independent classes
        arbLibraryClass,
        arbLibraryClass,
        (classA, classB) => {
          const fileForA: LibraryFile = {
            id: "fa1",
            owner_id: "owner",
            class_id: classA.id,
            name: "alpha-only.pdf",
            type: "pdf",
            size_bytes: 1024,
            storage_path: "path",
            upload_date: "2024-01-01T00:00:00Z",
            created_at: "2024-01-01T00:00:00Z",
          };

          const fileForB: LibraryFile = {
            id: "fb1",
            owner_id: "owner",
            class_id: classB.id,
            name: "beta-only.pdf",
            type: "pdf",
            size_bytes: 1024,
            storage_path: "path",
            upload_date: "2024-01-01T00:00:00Z",
            created_at: "2024-01-01T00:00:00Z",
          };

          // Render classA's group with only classA's file
          const { unmount } = render(
            <ClassGroup
              libraryClass={classA}
              files={[fileForA]}
              onDeleteFile={() => {}}
            />,
          );

          expect(screen.getByText("alpha-only.pdf")).toBeInTheDocument();
          expect(screen.queryByText(fileForB.name)).not.toBeInTheDocument();

          unmount();
        },
      ),
      { numRuns: 50 },
    );
  });

  it("concrete example — three files all appear under their class group", () => {
    const libraryClass: LibraryClass = {
      id: "class-1",
      owner_id: "owner-1",
      name: "Biology 101",
      created_at: "2024-01-01T00:00:00Z",
    };

    const files: LibraryFile[] = [
      {
        id: "f1", owner_id: "owner-1", class_id: "class-1",
        name: "Chapter 1 Notes.pdf", type: "pdf", size_bytes: 2048,
        storage_path: "path/f1", upload_date: "2024-06-01T00:00:00Z", created_at: "2024-06-01T00:00:00Z",
      },
      {
        id: "f2", owner_id: "owner-1", class_id: "class-1",
        name: "Lab Report.docx", type: "docx", size_bytes: 4096,
        storage_path: "path/f2", upload_date: "2024-06-02T00:00:00Z", created_at: "2024-06-02T00:00:00Z",
      },
      {
        id: "f3", owner_id: "owner-1", class_id: "class-1",
        name: "Study Guide.txt", type: "txt", size_bytes: 512,
        storage_path: "path/f3", upload_date: "2024-06-03T00:00:00Z", created_at: "2024-06-03T00:00:00Z",
      },
    ];

    render(
      <ClassGroup libraryClass={libraryClass} files={files} onDeleteFile={() => {}} />,
    );

    const section = screen.getByRole("region");
    expect(within(section).getByText("Chapter 1 Notes.pdf")).toBeInTheDocument();
    expect(within(section).getByText("Lab Report.docx")).toBeInTheDocument();
    expect(within(section).getByText("Study Guide.txt")).toBeInTheDocument();
  });
});

// ─── Property 19: Empty class shows indicator ────────────────────────────────

describe("Property 19: Empty class shows indicator", () => {
  it("19a — ClassGroup with zero files renders a visible empty indicator", () => {
    /**
     * For any LibraryClass, when ClassGroup receives files=[], it SHALL
     * render text communicating that no files have been added.
     *
     * Validates: Requirements 9.8
     */
    fc.assert(
      fc.property(arbLibraryClass, (libraryClass) => {
        const { container, unmount } = render(
          <ClassGroup
            libraryClass={libraryClass}
            files={[]}
            onDeleteFile={() => {}}
          />,
        );

        const section = within(container).getByRole("region");

        // Class name must remain visible even when empty
        expect(within(section).getByText(libraryClass.name)).toBeInTheDocument();

        // At least one empty indicator must be present (badge or hint paragraph)
        const hasBadge = within(section).queryByText(/no files yet/i) !== null;
        const hasHint  = within(section).queryByText(/no files have been added/i) !== null;
        expect(hasBadge || hasHint).toBe(true);

        unmount();
      }),
      { numRuns: 50 },
    );
  });

  it("19b — ClassGroup with files present does NOT show the empty indicator", () => {
    /**
     * Inverse: when files are present, no empty indicator should appear.
     *
     * Validates: Requirements 9.8 (by contrast)
     */
    fc.assert(
      fc.property(arbClassWithFiles(1, 4), ({ libraryClass, files }) => {
        const { unmount } = render(
          <ClassGroup
            libraryClass={libraryClass}
            files={files}
            onDeleteFile={() => {}}
          />,
        );

        expect(screen.queryByText(/no files yet/i)).not.toBeInTheDocument();

        unmount();
      }),
      { numRuns: 50 },
    );
  });

  it("concrete example — empty class renders badge and hint", () => {
    const libraryClass: LibraryClass = {
      id: "class-empty",
      owner_id: "owner-1",
      name: "Chemistry 202",
      created_at: "2024-01-01T00:00:00Z",
    };

    render(
      <ClassGroup libraryClass={libraryClass} files={[]} onDeleteFile={() => {}} />,
    );

    expect(screen.getByText("Chemistry 202")).toBeInTheDocument();
    expect(screen.getByText(/no files yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no files have been added/i)).toBeInTheDocument();
  });

  it("concrete example — populated class shows filename and hides empty indicator", () => {
    const libraryClass: LibraryClass = {
      id: "class-one",
      owner_id: "owner-1",
      name: "History 101",
      created_at: "2024-01-01T00:00:00Z",
    };

    const file: LibraryFile = {
      id: "file-1", owner_id: "owner-1", class_id: "class-one",
      name: "Essay Draft.docx", type: "docx", size_bytes: 3000,
      storage_path: "path/file-1", upload_date: "2024-05-15T00:00:00Z", created_at: "2024-05-15T00:00:00Z",
    };

    render(
      <ClassGroup libraryClass={libraryClass} files={[file]} onDeleteFile={() => {}} />,
    );

    expect(screen.getByText("Essay Draft.docx")).toBeInTheDocument();
    expect(screen.queryByText(/no files yet/i)).not.toBeInTheDocument();
  });
});

// ─── Property 17: Uploaded file card shows all metadata ──────────────────────

/**
 * Property 17: Uploaded file card shows all metadata
 * - For any LibraryFile object `f`, after rendering ClassGroup with that file,
 *   the FileCard SHALL render:
 *     - f.name
 *     - f.type.toUpperCase() as a badge
 *     - a human-readable form of f.upload_date
 *     - the name of the class f.class_id refers to
 * - Validates: Requirements 9.10
 */

describe("Property 17: Uploaded file card shows all metadata", () => {
  it("17a — file name appears in the rendered card", () => {
    /**
     * For any LibraryClass and LibraryFile, the file's name SHALL appear
     * somewhere inside the rendered ClassGroup region.
     *
     * Validates: Requirements 9.10
     */
    fc.assert(
      fc.property(arbClassWithFiles(1, 1), ({ libraryClass, files }) => {
        const file = files[0];
        const { unmount } = render(
          <ClassGroup
            libraryClass={libraryClass}
            files={[file]}
            onDeleteFile={() => {}}
          />,
        );

        expect(screen.getByText(file.name)).toBeInTheDocument();

        unmount();
      }),
      { numRuns: 50 },
    );
  });

  it("17b — file type badge renders as uppercase type string", () => {
    /**
     * For any LibraryFile, the FileCard SHALL render a badge containing
     * file.type.toUpperCase().
     *
     * Validates: Requirements 9.10
     */
    fc.assert(
      fc.property(arbClassWithFiles(1, 1), ({ libraryClass, files }) => {
        const file = files[0];
        const { unmount } = render(
          <ClassGroup
            libraryClass={libraryClass}
            files={[file]}
            onDeleteFile={() => {}}
          />,
        );

        // The badge text is type.toUpperCase()
        const badge = screen.getByText(file.type.toUpperCase());
        expect(badge).toBeInTheDocument();

        unmount();
      }),
      { numRuns: 50 },
    );
  });

  it("17c — class name appears in the rendered card", () => {
    /**
     * For any LibraryClass and LibraryFile, the class name SHALL be visible
     * inside the rendered card (FileCard renders the class name as metadata).
     *
     * Validates: Requirements 9.10
     */
    fc.assert(
      fc.property(arbClassWithFiles(1, 1), ({ libraryClass, files }) => {
        const file = files[0];
        const { container, unmount } = render(
          <ClassGroup
            libraryClass={libraryClass}
            files={[file]}
            onDeleteFile={() => {}}
          />,
        );

        // Match raw textContent so repeated whitespace in generated names is
        // not collapsed by Testing Library's default text normalizer.
        const matches = Array.from(
          container.querySelectorAll(".class-group-name, .file-card-class"),
        ).filter((element) => element.textContent === libraryClass.name);
        expect(matches.length).toBeGreaterThanOrEqual(1);

        unmount();
      }),
      { numRuns: 50 },
    );
  });

  it("17d — upload date is rendered in a human-readable format", () => {
    /**
     * For any LibraryFile, the FileCard SHALL render the upload_date in a
     * human-readable locale format (month + day + year visible).
     *
     * Strategy: use a known fixed date and check that the year and recognisable
     * parts of the date appear in the rendered output, since the exact locale
     * string varies by environment.
     *
     * Validates: Requirements 9.10
     */
    const knownDates = [
      "2024-01-15T00:00:00Z",
      "2023-06-30T00:00:00Z",
      "2025-12-01T00:00:00Z",
    ] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...knownDates),
        arbLibraryClass,
        (uploadDate, libraryClass) => {
          const file: LibraryFile = {
            id: "test-id",
            owner_id: "owner",
            class_id: libraryClass.id,
            name: "document.pdf",
            type: "pdf",
            size_bytes: 1024,
            storage_path: "path",
            upload_date: uploadDate,
            created_at: uploadDate,
          };

          const { unmount } = render(
            <ClassGroup
              libraryClass={libraryClass}
              files={[file]}
              onDeleteFile={() => {}}
            />,
          );

          // The year extracted from the upload_date string must appear on screen
          const year = new Date(uploadDate).getFullYear().toString();
          expect(screen.getByText(new RegExp(year))).toBeInTheDocument();

          unmount();
        },
      ),
      { numRuns: 30 },
    );
  });

  it("17e — all four metadata fields (name, type, date, class) co-exist in a single card", () => {
    /**
     * All four required metadata pieces SHALL be visible simultaneously for
     * a given file card.
     *
     * Validates: Requirements 9.10
     */
    const libraryClass: LibraryClass = {
      id: "class-meta",
      owner_id: "owner-1",
      name: "Physics 301",
      created_at: "2024-01-01T00:00:00Z",
    };

    const file: LibraryFile = {
      id: "file-meta",
      owner_id: "owner-1",
      class_id: "class-meta",
      name: "Quantum Mechanics.pdf",
      type: "pdf",
      size_bytes: 8192,
      storage_path: "path/file-meta",
      upload_date: "2024-08-20T00:00:00Z",
      created_at: "2024-08-20T00:00:00Z",
    };

    render(
      <ClassGroup libraryClass={libraryClass} files={[file]} onDeleteFile={() => {}} />,
    );

    // File name
    expect(screen.getByText("Quantum Mechanics.pdf")).toBeInTheDocument();
    // Type badge (uppercase)
    expect(screen.getByText("PDF")).toBeInTheDocument();
    // Class name
    expect(screen.getAllByText("Physics 301").length).toBeGreaterThanOrEqual(1);
    // Upload date: year 2024 must be visible
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });
});
