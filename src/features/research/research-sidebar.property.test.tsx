/**
 * Property tests for ResearchSidebar session selection (Property 11)
 *
 * Property 11: Research session selection shows correct question
 * - For any `ResearchSession` object `s`, clicking `s` in the
 *   `ResearchSidebar` SHALL cause the main area header to display exactly
 *   `s.question`.
 *
 * Validates: Requirements 8.3
 *
 * Testing approach:
 * The full flow (sidebar click → parent state → header render) is split into
 * two verifiable legs.
 *
 * Leg A (callback contract — pure interaction):
 *   For any ResearchSession `s` in a rendered sidebar, clicking the button
 *   for `s` SHALL invoke `setActive` with exactly `s.id`.
 *   Because `activeSession.question` is set by the parent from the session
 *   whose `id` was passed to `setActive`, this verifies the selection contract.
 *
 * Leg B (question visibility):
 *   For any ResearchSession `s`, the session's `question` text SHALL be
 *   visible as text within the sidebar item button, so the user can read what
 *   they are selecting before clicking.
 *
 * Both legs are exercised with fast-check over arbitrarily generated sessions.
 *
 * Note on accessible name matching:
 * The sidebar button contains both the question <span> and a <time> date
 * element. The button's full accessible name is therefore
 * "question text<date>". We locate buttons by their `data-session-id`
 * attribute (or by querying the question span text directly) rather than
 * by role+name, to keep tests independent of date formatting.
 */

import * as fc from "fast-check";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, afterEach, describe, it, expect } from "vitest";
import { ResearchSidebar } from "./research-sidebar";
import type { ResearchSession } from "./research-schema";

// ─── Module-level mocks ───────────────────────────────────────────────────────

// Stub ResearchSessionForm — it is a child component with its own tests.
// We do not want its internal state to interfere with sidebar interaction tests.
vi.mock("./research-session-form", () => ({
  ResearchSessionForm: ({
    createSession,
  }: {
    createSession: (q: string) => Promise<void>;
    sessionError: string | null;
  }) =>
    React.createElement(
      "form",
      { "data-testid": "research-session-form-stub" },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => void createSession("stub question for testing"),
        },
        "stub-submit",
      ),
    ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * Arbitrary that generates a ResearchSession with a non-whitespace question
 * of 10–200 chars (the sidebar renders any non-empty question as a span).
 *
 * We use `fc.stringMatching` with a regex that requires at least one
 * non-whitespace character followed by arbitrary content, trimmed to the
 * required length range.
 */
const arbitraryQuestion: fc.Arbitrary<string> = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 1 }).filter((c) => c.trim().length > 0),
    fc.string({ minLength: 9, maxLength: 199 }),
  )
  .map(([first, rest]) => first + rest);

const arbitraryResearchSession: fc.Arbitrary<ResearchSession> = fc.record({
  id: fc.uuid(),
  owner_id: fc.uuid(),
  question: arbitraryQuestion,
  created_at: fc
    .date({ min: new Date("2024-01-01"), max: new Date("2030-01-01") })
    .map((d) => d.toISOString()),
  updated_at: fc
    .date({ min: new Date("2024-01-01"), max: new Date("2030-01-01") })
    .map((d) => d.toISOString()),
});

/**
 * A non-empty list of sessions with guaranteed distinct ids (uuid() is
 * extremely unlikely to collide, but we filter to be safe).
 */
const arbitrarySessionList: fc.Arbitrary<ResearchSession[]> = fc
  .array(arbitraryResearchSession, { minLength: 1, maxLength: 6 })
  .filter((list) => new Set(list.map((s) => s.id)).size === list.length);

/** Render ResearchSidebar with controlled props and return mock callbacks + container. */
function renderSidebar(
  sessions: ResearchSession[],
  activeSession: ResearchSession | null = null,
) {
  const setActive = vi.fn();
  const createSession = vi.fn().mockResolvedValue(undefined);

  const { container } = render(
    React.createElement(ResearchSidebar, {
      sessions,
      activeSession,
      setActive,
      createSession,
      sessionError: null,
    }),
  );

  return { setActive, createSession, container };
}

/**
 * Find the session button that contains a given question string.
 * The button's full text includes a date suffix, so we query within the
 * rendered container's <nav> for all buttons then find the one whose
 * question <span> matches. Scoping to the container avoids false matches
 * from prior renders that haven't been detached yet.
 */
function findButtonByQuestion(
  container: HTMLElement,
  question: string,
): HTMLElement | null {
  const nav = container.querySelector("nav[aria-label='Research session list']");
  if (!nav) return null;

  const buttons = Array.from(nav.querySelectorAll("button"));
  return (
    buttons.find((btn) => {
      // The question is rendered in a <span class="research-session-question">.
      // We compare the raw textContent (without trimming) so the question
      // string is matched exactly as rendered.
      const span = btn.querySelector(".research-session-question");
      return span?.textContent === question;
    }) ?? null
  );
}

// ─── Leg A: setActive callback receives correct session id ────────────────────

describe("Property 11 — Leg A: clicking a session calls setActive with its id", () => {
  it("11a — for any single session, clicking its button calls setActive(session.id)", async () => {
    /**
     * For any ResearchSession s, clicking the button rendered for s in the
     * sidebar SHALL invoke setActive with exactly s.id (Requirement 8.3).
     */
    await fc.assert(
      fc.asyncProperty(arbitraryResearchSession, async (session) => {
        const { setActive, container } = renderSidebar([session]);

        const button = findButtonByQuestion(container, session.question);
        expect(button).not.toBeNull();

        const user = userEvent.setup();
        await user.click(button!);

        expect(setActive).toHaveBeenCalledOnce();
        expect(setActive).toHaveBeenCalledWith(session.id);

        cleanup();
      }),
      { numRuns: 20 },
    );
  }, 30_000);

  it("11b — for a list of sessions, clicking any one session calls setActive with that session's id only", async () => {
    /**
     * For any list of ResearchSessions, clicking session at index i SHALL call
     * setActive with sessions[i].id and no other id.
     */
    await fc.assert(
      fc.asyncProperty(
        arbitrarySessionList,
        fc.nat(),
        async (sessions, rawIndex) => {
          const targetIndex = rawIndex % sessions.length;
          const target = sessions[targetIndex]!;

          const { setActive, container } = renderSidebar(sessions);

          const button = findButtonByQuestion(container, target.question);
          expect(button).not.toBeNull();

          const user = userEvent.setup();
          await user.click(button!);

          expect(setActive).toHaveBeenCalledOnce();
          expect(setActive).toHaveBeenCalledWith(target.id);

          cleanup();
        },
      ),
      { numRuns: 20 },
    );
  }, 30_000);

  // Concrete examples (Requirements 8.3)

  it("concrete — clicking the first of two sessions calls setActive with its id", async () => {
    const sessionA: ResearchSession = {
      id: "session-id-a",
      owner_id: "owner-1",
      question: "How does sleep affect memory consolidation?",
      created_at: "2024-06-01T10:00:00Z",
      updated_at: "2024-06-02T12:00:00Z",
    };
    const sessionB: ResearchSession = {
      id: "session-id-b",
      owner_id: "owner-1",
      question: "What are the effects of exercise on cognition?",
      created_at: "2024-06-01T09:00:00Z",
      updated_at: "2024-06-01T09:00:00Z",
    };

    const { setActive, container } = renderSidebar([sessionA, sessionB]);

    const user = userEvent.setup();
    const buttonA = findButtonByQuestion(container, sessionA.question);
    expect(buttonA).not.toBeNull();
    await user.click(buttonA!);

    expect(setActive).toHaveBeenCalledWith("session-id-a");
    expect(setActive).not.toHaveBeenCalledWith("session-id-b");
  });

  it("concrete — clicking the second of two sessions calls setActive with its id", async () => {
    const sessionA: ResearchSession = {
      id: "session-id-a",
      owner_id: "owner-1",
      question: "How does sleep affect memory consolidation?",
      created_at: "2024-06-01T10:00:00Z",
      updated_at: "2024-06-02T12:00:00Z",
    };
    const sessionB: ResearchSession = {
      id: "session-id-b",
      owner_id: "owner-1",
      question: "What are the effects of exercise on cognition?",
      created_at: "2024-06-01T09:00:00Z",
      updated_at: "2024-06-01T09:00:00Z",
    };

    const { setActive, container } = renderSidebar([sessionA, sessionB]);

    const user = userEvent.setup();
    const buttonB = findButtonByQuestion(container, sessionB.question);
    expect(buttonB).not.toBeNull();
    await user.click(buttonB!);

    expect(setActive).toHaveBeenCalledWith("session-id-b");
    expect(setActive).not.toHaveBeenCalledWith("session-id-a");
  });
});

// ─── Leg B: Session question is visible as text inside the sidebar item ───────

describe("Property 11 — Leg B: session question is visible in the sidebar", () => {
  it("11c — for any session, its question text is rendered inside the session button", () => {
    /**
     * For any ResearchSession s rendered in the sidebar, s.question SHALL be
     * visible as text in the sidebar item button (Requirement 8.3).
     */
    fc.assert(
      fc.property(arbitraryResearchSession, (session) => {
        const { container } = renderSidebar([session]);

        const button = findButtonByQuestion(container, session.question);
        expect(button).not.toBeNull();
        expect(button).toBeInTheDocument();

        cleanup();
      }),
    );
  });

  it("11d — for a list of sessions, every session's question is rendered as a button", () => {
    /**
     * For any list of ResearchSessions, every question SHALL appear inside a
     * distinct button in the sidebar, so all sessions are selectable.
     */
    fc.assert(
      fc.property(arbitrarySessionList, (sessions) => {
        const { container } = renderSidebar(sessions);

        for (const session of sessions) {
          const button = findButtonByQuestion(container, session.question);
          expect(button).not.toBeNull();
          expect(button).toBeInTheDocument();
        }

        cleanup();
      }),
    );
  });

  // Concrete examples

  it("concrete — the active session button carries aria-current='true'", () => {
    const session: ResearchSession = {
      id: "session-id-active",
      owner_id: "owner-1",
      question: "How does caffeine affect focus and productivity?",
      created_at: "2024-06-01T10:00:00Z",
      updated_at: "2024-06-02T12:00:00Z",
    };

    renderSidebar([session], session);

    const button = findButtonByQuestion(
      document.body as HTMLElement,
      session.question,
    );
    expect(button).not.toBeNull();
    expect(button).toHaveAttribute("aria-current", "true");
  });

  it("concrete — a non-active session button does not carry aria-current", () => {
    const active: ResearchSession = {
      id: "session-active",
      owner_id: "owner-1",
      question: "How does caffeine affect focus and productivity?",
      created_at: "2024-06-01T10:00:00Z",
      updated_at: "2024-06-02T12:00:00Z",
    };
    const inactive: ResearchSession = {
      id: "session-inactive",
      owner_id: "owner-1",
      question: "What role does nutrition play in academic performance?",
      created_at: "2024-05-01T10:00:00Z",
      updated_at: "2024-05-01T10:00:00Z",
    };

    renderSidebar([active, inactive], active);

    const inactiveButton = findButtonByQuestion(
      document.body as HTMLElement,
      inactive.question,
    );
    expect(inactiveButton).not.toBeNull();
    expect(inactiveButton).not.toHaveAttribute("aria-current");
  });

  it("concrete — empty session list renders empty state, no session nav", () => {
    renderSidebar([]);

    // The session list nav should not be in the DOM
    expect(
      screen.queryByRole("navigation", { name: "Research session list" }),
    ).toBeNull();

    // Empty state message is shown
    expect(screen.getByText("No research sessions yet")).toBeInTheDocument();
  });
});
