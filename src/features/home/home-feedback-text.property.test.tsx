/**
 * Property tests for HomeFeedbackText — presence-to-feedback mapping (Property 9)
 *
 * Property 9: Home feedback text maps presence
 * - For any value of `MascotPresence`, rendering `HomeFeedbackText` with that
 *   presence injected through `MascotContext` SHALL display exactly the feedback
 *   string defined in the `feedbackText` map for that presence value.
 *
 * Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6
 */

import * as fc from "fast-check";
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { HomeFeedbackText } from "./home-feedback-text";
import type { MascotPresence, MascotState, MascotAction } from "@/features/mascot/mascot-state";

// ─── Expected mapping (mirrors the production feedbackText map) ───────────────
//
// This is the authoritative expected mapping defined by Requirements 7.2–7.6.
// The test verifies the component's PUBLIC output against this contract.

const expectedFeedback: Record<MascotPresence, string> = {
  idle:        "What are we studying today?",
  sleeping:    "What are we studying today?",
  error:       "What are we studying today?",
  listening:   "I'm listening…",
  thinking:    "Let me investigate that.",
  working:     "Let me investigate that.",
  researching: "I'm comparing the evidence.",
  speaking:    "Here's what I found.",
};

// ─── All valid MascotPresence values ─────────────────────────────────────────

const ALL_PRESENCES: MascotPresence[] = [
  "idle",
  "sleeping",
  "error",
  "listening",
  "thinking",
  "speaking",
  "working",
  "researching",
];

// ─── Context mock helper ──────────────────────────────────────────────────────
//
// HomeFeedbackText calls useMascot(), which reads from MascotContext.
// We supply a minimal context value with a controlled presence so we can test
// every presence value independently without triggering the real MascotProvider
// (which starts timers and requires a browser-like window environment).

function buildMascotState(presence: MascotPresence): MascotState {
  return {
    presence,
    mood: "neutral",
    mode: "normal",
    message: "test message",
  };
}

// Mock the provider module so useMascot() returns a controlled value.
vi.mock("@/features/mascot/mascot-provider", () => ({
  useMascot: vi.fn(),
}));

import { useMascot } from "@/features/mascot/mascot-provider";

// ─── Property 9: presence → feedback text ────────────────────────────────────

describe("Property 9: HomeFeedbackText maps MascotPresence to feedback text", () => {
  // ─── Property 9a: rendered text matches feedbackText map ─────────────────

  it("9a — for any MascotPresence value the rendered text matches the feedbackText map", () => {
    /**
     * For any MascotPresence value `p`, rendering HomeFeedbackText with
     * state.presence = p SHALL produce visible text equal to expectedFeedback[p].
     *
     * Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESENCES),
        (presence) => {
          vi.mocked(useMascot).mockReturnValue({
            state: buildMascotState(presence),
            amplitude: 0,
            dispatch: vi.fn() as React.Dispatch<MascotAction>,
            setAmplitude: vi.fn(),
            celebrate: vi.fn(),
          });

          const { unmount } = render(React.createElement(HomeFeedbackText));
          const el = screen.getByText(expectedFeedback[presence]);
          expect(el).toBeDefined();
          unmount();
        },
      ),
    );
  });

  // ─── Property 9b: aria attributes ────────────────────────────────────────

  it("9b — the paragraph element carries aria-live=\"polite\" and aria-atomic=\"true\"", () => {
    /**
     * The rendered <p> element SHALL have aria-live="polite" and
     * aria-atomic="true" so that screen readers announce changes as
     * MascotPresence transitions occur (Req 5.6 pattern, implied by 7.7).
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESENCES),
        (presence) => {
          vi.mocked(useMascot).mockReturnValue({
            state: buildMascotState(presence),
            amplitude: 0,
            dispatch: vi.fn() as React.Dispatch<MascotAction>,
            setAmplitude: vi.fn(),
            celebrate: vi.fn(),
          });

          const { unmount } = render(React.createElement(HomeFeedbackText));
          const el = screen.getByText(expectedFeedback[presence]);
          expect(el.getAttribute("aria-live")).toBe("polite");
          expect(el.getAttribute("aria-atomic")).toBe("true");
          unmount();
        },
      ),
    );
  });

  // ─── Concrete examples per requirement ───────────────────────────────────

  it("concrete: idle → standby prompt (Req 7.6)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("idle"),
      amplitude: 0,
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(HomeFeedbackText));
    expect(screen.getByText("What are we studying today?")).toBeInTheDocument();
    unmount();
  });

  it("concrete: sleeping → standby prompt (Req 7.6)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("sleeping"),
      amplitude: 0,
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(HomeFeedbackText));
    expect(screen.getByText("What are we studying today?")).toBeInTheDocument();
    unmount();
  });

  it("concrete: error → standby prompt (Req 7.6)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("error"),
      amplitude: 0,
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(HomeFeedbackText));
    expect(screen.getByText("What are we studying today?")).toBeInTheDocument();
    unmount();
  });

  it("concrete: listening → \"I'm listening…\" (Req 7.2)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("listening"),
      amplitude: 0,
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(HomeFeedbackText));
    expect(screen.getByText("I'm listening…")).toBeInTheDocument();
    unmount();
  });

  it("concrete: thinking → \"Let me investigate that.\" (Req 7.3)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("thinking"),
      amplitude: 0,
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(HomeFeedbackText));
    expect(screen.getByText("Let me investigate that.")).toBeInTheDocument();
    unmount();
  });

  it("concrete: working → \"Let me investigate that.\" (Req 7.3)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("working"),
      amplitude: 0,
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(HomeFeedbackText));
    expect(screen.getByText("Let me investigate that.")).toBeInTheDocument();
    unmount();
  });

  it("concrete: researching → \"I'm comparing the evidence.\" (Req 7.4)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("researching"),
      amplitude: 0,
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(HomeFeedbackText));
    expect(screen.getByText("I'm comparing the evidence.")).toBeInTheDocument();
    unmount();
  });

  it("concrete: speaking → \"Here's what I found.\" (Req 7.5)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("speaking"),
      amplitude: 0,
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(HomeFeedbackText));
    expect(screen.getByText("Here's what I found.")).toBeInTheDocument();
    unmount();
  });

  // ─── Presence change causes text to update ───────────────────────────────

  it("9c — a presence change causes the feedback text to update to the new expected string", () => {
    /**
     * For any two MascotPresence values p1 and p2, re-rendering
     * HomeFeedbackText with presence = p2 after presence = p1 SHALL display
     * expectedFeedback[p2] (unless both map to the same text, e.g.
     * idle/sleeping/error → "What are we studying today?").
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESENCES),
        fc.constantFrom(...ALL_PRESENCES),
        (p1, p2) => {
          vi.mocked(useMascot).mockReturnValue({
            state: buildMascotState(p1),
            amplitude: 0,
            dispatch: vi.fn() as React.Dispatch<MascotAction>,
            setAmplitude: vi.fn(),
            celebrate: vi.fn(),
          });

          const { rerender, unmount } = render(React.createElement(HomeFeedbackText));

          vi.mocked(useMascot).mockReturnValue({
            state: buildMascotState(p2),
            amplitude: 0,
            dispatch: vi.fn() as React.Dispatch<MascotAction>,
            setAmplitude: vi.fn(),
            celebrate: vi.fn(),
          });

          rerender(React.createElement(HomeFeedbackText));

          const el = screen.getByText(expectedFeedback[p2]);
          expect(el).toBeDefined();
          unmount();
        },
      ),
    );
  });

  // ─── Completeness guard ───────────────────────────────────────────────────

  it("completeness — expectedFeedback covers all 8 MascotPresence values", () => {
    /**
     * Guard that the test's own expectedFeedback map is complete. If a new
     * MascotPresence value is added without updating this map, this test will
     * fail, preventing silent regressions.
     */
    const mappedPresences = new Set(Object.keys(expectedFeedback));
    for (const p of ALL_PRESENCES) {
      expect(mappedPresences.has(p)).toBe(true);
    }
    expect(mappedPresences.size).toBe(ALL_PRESENCES.length);
  });
});
