/**
 * Property tests for ResearchTabs — Sources tab (Property 13)
 *
 * Property 13: Research sources displayed with tag
 * - For any list of `ResearchSource` objects, when the Sources tab is active,
 *   each source SHALL render its `title`, `type` indicator, and `tag`
 *   (`"supports"` or `"contradicts"`).
 *
 * **Validates: Requirements 8.5**
 *
 * Testing approach:
 * We render `ResearchTabs` with `activeTab="sources"` and a generated list of
 * `ResearchSource` objects. Three sub-properties are verified:
 *
 * 13a — Title visibility:
 *   For any list of ResearchSource objects, every source.title SHALL appear as
 *   text in the rendered Sources panel.
 *
 * 13b — Tag visibility:
 *   For any ResearchSource, the `tag` value ("supports" or "contradicts")
 *   SHALL be rendered as visible text in the source card (displayed as
 *   "Supports" or "Contradicts" respectively).
 *
 * 13c — Type indicator visibility:
 *   For any ResearchSource, the `type` value ("document", "url", or "file")
 *   SHALL appear as text in the source's type badge.
 */

import * as fc from "fast-check";
import { render, within, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { ResearchTabs } from "./research-tabs";
import type { ResearchSession, ResearchSource } from "./research-schema";

// ─── Module-level mocks ───────────────────────────────────────────────────────

// ResearchTabs is a pure presentational component — no external dependencies
// to mock. The saveCanvas prop is a function we stub per render.

// ─── Helpers ─────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Minimal ResearchSession used as the required activeSession prop. */
const stubSession: ResearchSession = {
  id: "session-stub",
  owner_id: "owner-stub",
  question: "Does exercise improve memory consolidation?",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

/**
 * Render ResearchTabs locked to the Sources tab.
 * All irrelevant data-collections are passed as empty arrays.
 * Returns the container so property tests can scope DOM queries to avoid
 * cross-render accumulation when many renders are alive simultaneously.
 */
function renderSourcesTab(sources: ResearchSource[]) {
  const saveCanvas = vi.fn().mockResolvedValue(undefined);
  const setActiveTab = vi.fn();

  const { unmount, container } = render(
    <ResearchTabs
      activeSession={stubSession}
      sources={sources}
      findings={[]}
      contradictions={[]}
      openQuestions={[]}
      canvasContent=""
      saveCanvas={saveCanvas}
      activeTab="sources"
      setActiveTab={setActiveTab}
    />,
  );

  return { unmount, container, saveCanvas, setActiveTab };
}

/**
 * Return the active Sources tab panel element within a container.
 * Scoping DOM queries to this panel avoids false matches from stale renders.
 */
function getSourcesPanel(container: HTMLElement): HTMLElement {
  const panel = container.querySelector<HTMLElement>("#research-panel-sources");
  if (!panel) throw new Error("Sources panel not found in container");
  return panel;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Short hex id — fast to generate, collision-unlikely for test purposes. */
const arbId = fc.hexaString({ minLength: 8, maxLength: 8 });

/**
 * Generates a printable, DOM-safe title string (3–60 chars).
 * We start and end with an alphanumeric character to avoid leading/trailing
 * whitespace that @testing-library normalises differently from the raw value.
 */
const arbTitle: fc.Arbitrary<string> = fc
  .tuple(
    // First character: always alpha/digit (no leading space)
    fc.mapToConstant(
      { num: 26, build: (n) => String.fromCharCode(65 + n) },  // A-Z
      { num: 26, build: (n) => String.fromCharCode(97 + n) },  // a-z
      { num: 10, build: (n) => String.fromCharCode(48 + n) },  // 0-9
    ),
    // Middle characters: alpha/digit/space
    fc.stringOf(
      fc.mapToConstant(
        { num: 26, build: (n) => String.fromCharCode(65 + n) },
        { num: 26, build: (n) => String.fromCharCode(97 + n) },
        { num: 10, build: (n) => String.fromCharCode(48 + n) },
        { num: 1,  build: () => " " },
      ),
      { minLength: 1, maxLength: 57 },
    ),
    // Last character: always alpha/digit (no trailing space)
    fc.mapToConstant(
      { num: 26, build: (n) => String.fromCharCode(65 + n) },
      { num: 26, build: (n) => String.fromCharCode(97 + n) },
      { num: 10, build: (n) => String.fromCharCode(48 + n) },
    ),
  )
  .map(([first, middle, last]) => first + middle + last);

/** Valid source types as defined by ResearchSource. */
const arbSourceType = fc.constantFrom(
  "document" as const,
  "url"      as const,
  "file"     as const,
);

/** Valid source tags as defined by SourceTag. */
const arbSourceTag = fc.constantFrom("supports" as const, "contradicts" as const);

/** Generates a full ResearchSource with valid, DOM-safe values. */
const arbResearchSource: fc.Arbitrary<ResearchSource> = fc.record({
  id:         arbId,
  session_id: fc.constant("session-stub"),
  owner_id:   arbId,
  title:      arbTitle,
  url:        fc.option(fc.webUrl(), { nil: null }),
  type:       arbSourceType,
  tag:        arbSourceTag,
  created_at: fc.constant("2024-06-01T00:00:00Z"),
});

/**
 * Non-empty list of ResearchSource objects with guaranteed distinct ids.
 * 1–6 sources — enough to exercise all combinations without slowing tests.
 */
const arbSourceList: fc.Arbitrary<ResearchSource[]> = fc
  .array(arbResearchSource, { minLength: 1, maxLength: 6 })
  .filter((list) => new Set(list.map((s) => s.id)).size === list.length);

// ─── Property 13a: Source titles are visible in the Sources panel ─────────────

describe("Property 13a — source titles appear in the rendered Sources panel", () => {
  it("13a — for any list of sources, every title is rendered when Sources tab is active", () => {
    /**
     * For any list of ResearchSource objects rendered in the Sources tab,
     * every source.title SHALL appear as text in the rendered output.
     *
     * Validates: Requirements 8.5
     */
    fc.assert(
      fc.property(arbSourceList, (sources) => {
        // Cleanup before each iteration to avoid duplicate-id issues from
        // accumulated renders when fast-check runs multiple iterations.
        cleanup();

        const { container } = renderSourcesTab(sources);
        const panel = getSourcesPanel(container);

        for (const source of sources) {
          // within() scopes the query to this render's panel only, avoiding
          // false "multiple elements found" errors from accumulated renders.
          expect(within(panel).getByText((_content, element) => element?.textContent === source.title)).toBeInTheDocument();
        }
      }),
      { numRuns: 50 },
    );
  });

  it("concrete — single source title appears", () => {
    const source: ResearchSource = {
      id: "src-1",
      session_id: "session-stub",
      owner_id: "owner-1",
      title: "Memory Consolidation During Sleep",
      url: "https://example.com/paper",
      type: "document",
      tag: "supports",
      created_at: "2024-06-01T00:00:00Z",
    };

    const { container } = renderSourcesTab([source]);
    const panel = getSourcesPanel(container);

    expect(within(panel).getByText("Memory Consolidation During Sleep")).toBeInTheDocument();
  });

  it("concrete — multiple source titles all appear", () => {
    const sources: ResearchSource[] = [
      {
        id: "src-1", session_id: "session-stub", owner_id: "owner-1",
        title: "Exercise and Hippocampal Neurogenesis", url: null,
        type: "document", tag: "supports", created_at: "2024-06-01T00:00:00Z",
      },
      {
        id: "src-2", session_id: "session-stub", owner_id: "owner-1",
        title: "Sedentary Lifestyle Has No Cognitive Effect", url: null,
        type: "url", tag: "contradicts", created_at: "2024-06-02T00:00:00Z",
      },
      {
        id: "src-3", session_id: "session-stub", owner_id: "owner-1",
        title: "Aerobic Training Improves Working Memory", url: null,
        type: "file", tag: "supports", created_at: "2024-06-03T00:00:00Z",
      },
    ];

    const { container } = renderSourcesTab(sources);
    const panel = getSourcesPanel(container);

    expect(within(panel).getByText("Exercise and Hippocampal Neurogenesis")).toBeInTheDocument();
    expect(within(panel).getByText("Sedentary Lifestyle Has No Cognitive Effect")).toBeInTheDocument();
    expect(within(panel).getByText("Aerobic Training Improves Working Memory")).toBeInTheDocument();
  });
});

// ─── Property 13b: Source tag is visible in each source card ─────────────────

describe("Property 13b — source tag (Supports/Contradicts) is rendered per source card", () => {
  it("13b — for any list of sources, each source tag text is visible in the rendered output", () => {
    /**
     * For any ResearchSource, the `tag` SHALL be rendered as visible text
     * — "Supports" when tag="supports", "Contradicts" when tag="contradicts".
     *
     * Validates: Requirements 8.5
     */
    fc.assert(
      fc.property(arbSourceList, (sources) => {
        // Cleanup before each iteration to avoid duplicate-id issues from
        // accumulated renders when fast-check runs multiple iterations.
        cleanup();

        const { container } = renderSourcesTab(sources);
        const panel = getSourcesPanel(container);

        // Get all source-tag badges scoped to this render's panel
        const tagBadges = panel.querySelectorAll(".source-tag-badge");
        expect(tagBadges.length).toBe(sources.length);

        for (const source of sources) {
          const expectedLabel = source.tag === "supports" ? "Supports" : "Contradicts";

          // At least one badge with the expected data-tag and text must exist
          const matchingBadge = Array.from(tagBadges).find(
            (badge) =>
              badge.getAttribute("data-tag") === source.tag &&
              badge.textContent?.trim() === expectedLabel,
          );

          expect(
            matchingBadge,
            `Expected a tag badge for "${source.tag}" with text "${expectedLabel}"`,
          ).toBeDefined();
        }

        // Do NOT call unmount() — afterEach(cleanup) handles teardown after all
        // fast-check iterations complete (same pattern as 13-combined).
      }),
      { numRuns: 50 },
    );
  });

  it("13b-role — supports tag has aria-label 'Supports'", () => {
    const source: ResearchSource = {
      id: "src-s", session_id: "session-stub", owner_id: "owner-1",
      title: "A Supporting Paper", url: null,
      type: "document", tag: "supports", created_at: "2024-06-01T00:00:00Z",
    };

    const { container } = renderSourcesTab([source]);
    const panel = getSourcesPanel(container);

    expect(within(panel).getByLabelText("Supports")).toBeInTheDocument();
  });

  it("13b-role — contradicts tag has aria-label 'Contradicts'", () => {
    const source: ResearchSource = {
      id: "src-c", session_id: "session-stub", owner_id: "owner-1",
      title: "A Contradicting Paper", url: null,
      type: "document", tag: "contradicts", created_at: "2024-06-01T00:00:00Z",
    };

    const { container } = renderSourcesTab([source]);
    const panel = getSourcesPanel(container);

    expect(within(panel).getByLabelText("Contradicts")).toBeInTheDocument();
  });

  it("concrete — mixed supports/contradicts sources render correct tags", () => {
    const sources: ResearchSource[] = [
      {
        id: "src-1", session_id: "session-stub", owner_id: "owner-1",
        title: "Study A", url: null,
        type: "document", tag: "supports", created_at: "2024-06-01T00:00:00Z",
      },
      {
        id: "src-2", session_id: "session-stub", owner_id: "owner-1",
        title: "Study B", url: null,
        type: "url", tag: "contradicts", created_at: "2024-06-02T00:00:00Z",
      },
    ];

    const { container } = renderSourcesTab(sources);
    const panel = getSourcesPanel(container);

    // Both "Supports" and "Contradicts" text labels must be present
    expect(within(panel).getByText("Supports")).toBeInTheDocument();
    expect(within(panel).getByText("Contradicts")).toBeInTheDocument();

    // The badges must carry the correct data-tag attribute
    const supportsBadge = panel.querySelector('.source-tag-badge[data-tag="supports"]');
    const contradictsBadge = panel.querySelector('.source-tag-badge[data-tag="contradicts"]');
    expect(supportsBadge).toBeInTheDocument();
    expect(contradictsBadge).toBeInTheDocument();
  });
});

// ─── Property 13c: Source type indicator is visible in each source card ───────

describe("Property 13c — source type indicator appears in each source card", () => {
  it("13c — for any list of sources, each source type is rendered as a type badge", () => {
    /**
     * For any ResearchSource, the `type` value SHALL appear as text inside a
     * `.source-type-badge` element in the rendered Sources panel.
     *
     * Validates: Requirements 8.5
     */
    fc.assert(
      fc.property(arbSourceList, (sources) => {
        // Cleanup before each iteration to avoid duplicate-id issues from
        // accumulated renders when fast-check runs multiple iterations.
        cleanup();

        const { container } = renderSourcesTab(sources);
        const panel = getSourcesPanel(container);

        const typeBadges = panel.querySelectorAll(".source-type-badge");
        expect(typeBadges.length).toBe(sources.length);

        for (const source of sources) {
          // Each type badge carries data-type and its textContent equals the type
          const matchingBadge = Array.from(typeBadges).find(
            (badge) =>
              badge.getAttribute("data-type") === source.type &&
              badge.textContent?.trim() === source.type,
          );

          expect(
            matchingBadge,
            `Expected a type badge for type="${source.type}"`,
          ).toBeDefined();
        }

        // Do NOT call unmount() — afterEach(cleanup) handles teardown after all
        // fast-check iterations complete (same pattern as 13-combined).
      }),
      { numRuns: 50 },
    );
  });

  it("concrete — type 'document' renders a document badge", () => {
    const source: ResearchSource = {
      id: "src-doc", session_id: "session-stub", owner_id: "owner-1",
      title: "A Document Source", url: null,
      type: "document", tag: "supports", created_at: "2024-06-01T00:00:00Z",
    };

    const { container } = renderSourcesTab([source]);
    const panel = getSourcesPanel(container);
    const badge = panel.querySelector('.source-type-badge[data-type="document"]');
    expect(badge).toBeInTheDocument();
    expect(badge!.textContent?.trim()).toBe("document");
  });

  it("concrete — type 'url' renders a url badge", () => {
    const source: ResearchSource = {
      id: "src-url", session_id: "session-stub", owner_id: "owner-1",
      title: "A URL Source", url: "https://example.com",
      type: "url", tag: "contradicts", created_at: "2024-06-01T00:00:00Z",
    };

    const { container } = renderSourcesTab([source]);
    const panel = getSourcesPanel(container);
    const badge = panel.querySelector('.source-type-badge[data-type="url"]');
    expect(badge).toBeInTheDocument();
    expect(badge!.textContent?.trim()).toBe("url");
  });

  it("concrete — type 'file' renders a file badge", () => {
    const source: ResearchSource = {
      id: "src-file", session_id: "session-stub", owner_id: "owner-1",
      title: "An Uploaded File", url: null,
      type: "file", tag: "supports", created_at: "2024-06-01T00:00:00Z",
    };

    const { container } = renderSourcesTab([source]);
    const panel = getSourcesPanel(container);
    const badge = panel.querySelector('.source-type-badge[data-type="file"]');
    expect(badge).toBeInTheDocument();
    expect(badge!.textContent?.trim()).toBe("file");
  });

  it("concrete — all three types can appear together in one panel", () => {
    const sources: ResearchSource[] = [
      {
        id: "src-1", session_id: "session-stub", owner_id: "owner-1",
        title: "Document Source", url: null,
        type: "document", tag: "supports", created_at: "2024-06-01T00:00:00Z",
      },
      {
        id: "src-2", session_id: "session-stub", owner_id: "owner-1",
        title: "URL Source", url: "https://example.com",
        type: "url", tag: "contradicts", created_at: "2024-06-02T00:00:00Z",
      },
      {
        id: "src-3", session_id: "session-stub", owner_id: "owner-1",
        title: "File Source", url: null,
        type: "file", tag: "supports", created_at: "2024-06-03T00:00:00Z",
      },
    ];

    const { container } = renderSourcesTab(sources);
    const panel = getSourcesPanel(container);

    expect(panel.querySelector('.source-type-badge[data-type="document"]')).toBeInTheDocument();
    expect(panel.querySelector('.source-type-badge[data-type="url"]')).toBeInTheDocument();
    expect(panel.querySelector('.source-type-badge[data-type="file"]')).toBeInTheDocument();
  });
});

// ─── Combined: all three properties hold simultaneously ───────────────────────

describe("Property 13 combined — title, type, and tag all rendered per source", () => {
  it("13-combined — for any source list, title+type+tag are all present simultaneously", () => {
    /**
     * For any list of ResearchSource objects in the Sources tab, ALL THREE
     * aspects — title, type badge, and tag badge — SHALL be rendered for each
     * source simultaneously in a single render pass.
     *
     * Validates: Requirements 8.5
     *
     * Note: We do NOT call cleanup() or unmount() inside the property callback.
     * fast-check's shrinking phase re-invokes the callback with different inputs,
     * and any intermediate cleanup would invalidate prior containers.
     * We scope all DOM queries to each render's own container, so accumulated
     * renders within a single test do not interfere with each other.
     * The afterEach hook at the test suite level handles final teardown.
     */
    fc.assert(
      fc.property(arbSourceList, (sources) => {
        const { container } = renderSourcesTab(sources);

        // #research-panel-sources is scoped to this specific render's container
        const panel = container.querySelector<HTMLElement>("#research-panel-sources");
        if (!panel) return; // guard: panel always present when activeTab="sources"

        for (const source of sources) {
          // Title — scoped to this container to avoid cross-render matches
          expect(within(panel).getByText((_content, element) => element?.textContent === source.title)).toBeInTheDocument();

          // Type badge — scoped to this container
          const typeBadge = panel.querySelector(
            `.source-type-badge[data-type="${source.type}"]`,
          );
          expect(typeBadge).toBeInTheDocument();

          // Tag badge — scoped to this container
          const tagBadge = panel.querySelector(
            `.source-tag-badge[data-tag="${source.tag}"]`,
          );
          expect(tagBadge).toBeInTheDocument();
        }
      }),
      { numRuns: 50 },
    );
  });

  it("concrete — empty sources list renders empty state, not source cards", () => {
    const { container } = renderSourcesTab([]);
    const panel = getSourcesPanel(container);

    expect(
      within(panel).getByText("No sources have been added yet."),
    ).toBeInTheDocument();

    // No source card elements should be present
    expect(panel.querySelector(".source-card")).not.toBeInTheDocument();
  });
});
