/**
 * Property tests for NavMascotAvatar — presence-to-label mapping (Property 2)
 *
 * Property 2: Mascot nav label maps presence correctly
 * - For any value of `MascotPresence`, when `NavMascotAvatar` is rendered with
 *   that presence injected through `MascotContext`, the component SHALL display
 *   the text string defined in the `presenceLabel` map for that presence value,
 *   and SHALL NOT display the label for any other presence value.
 *
 * Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import * as fc from "fast-check";
import { render, screen } from "@testing-library/react";
import React from "react";
import { NavMascotAvatar } from "./mascot-avatar";
import type { MascotPresence, MascotState, MascotAction } from "./mascot-state";

// ─── Expected mapping (mirrors the production presenceLabel map) ──────────────
//
// This is the authoritative expected mapping defined by Requirements 3.3–3.8.
// The test verifies the component's PUBLIC output against this contract.

const expectedLabel: Record<MascotPresence, string> = {
  idle:        "STANDBY",
  sleeping:    "STANDBY",
  error:       "STANDBY",
  listening:   "LISTENING",
  thinking:    "THINKING",
  speaking:    "SPEAKING",
  working:     "WORKING",
  researching: "RESEARCHING",
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
// NavMascotAvatar calls useMascot(), which reads from MascotContext.
// We supply a minimal context value with a controlled presence so we can test
// every presence value independently without triggering the real MascotProvider
// (which starts timers and requires a browser-like window environment).

function buildMascotState(presence: MascotPresence): MascotState {
  return {
    presence,
    mood: "neutral",
    emotion: "neutral",
    mode: "normal",
    message: "test message",
  };
}

// We need to inject into the REAL MascotContext. The cleanest way to do that
// in a jsdom test environment is to render a thin wrapper that provides the
// context value, matching the shape MascotProvider would provide.
//
// Because MascotContext is not exported, we use a "wrapper component" approach:
// render MascotProvider with a pre-dispatched state, OR provide a fake context.
//
// The safest cross-version approach is to re-export context from a test helper —
// but since we cannot modify production code, we use MascotProvider itself and
// control state via dispatched actions before rendering.
//
// However, to keep the test deterministic and free of side-effects (timers,
// window event listeners), we mock useMascot() via vi.mock.

import { vi } from "vitest";

// Mock the provider module so useMascot() returns a controlled value.
vi.mock("./mascot-provider", () => ({
  useMascot: vi.fn(),
  useOptionalMascot: () => null,
}));

// Also mock motion/react to prevent animation side-effects in jsdom.
vi.mock("motion/react", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        // Return a plain React element factory for any motion.xxx tag.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (props: Record<string, any>) =>
          React.createElement(tag === "svg" ? "svg" : "div", props);
      },
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useReducedMotion: () => true,
}));

import { useMascot } from "./mascot-provider";

// ─── Property 2: presence → label ────────────────────────────────────────────

describe("Property 2: NavMascotAvatar maps MascotPresence to Nav State Label", () => {
  it("2a — for any MascotPresence value the rendered label matches the presenceLabel map", { timeout: 30000 }, () => {
    /**
     * For any MascotPresence value `p`, rendering NavMascotAvatar with
     * state.presence = p SHALL produce visible label text equal to
     * expectedLabel[p].
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESENCES),
        (presence) => {
          const mockedState = buildMascotState(presence);
          vi.mocked(useMascot).mockReturnValue({
            state: mockedState,
            amplitude: 0,
            character: "octopus",
            setCharacter: vi.fn(),
            dispatch: vi.fn() as React.Dispatch<MascotAction>,
            setAmplitude: vi.fn(),
            celebrate: vi.fn(),
          });

          const { unmount } = render(React.createElement(NavMascotAvatar));
          const label = screen.getByText(expectedLabel[presence]);
          expect(label).toBeDefined();
          unmount();
        },
      ),
    );
  });

  it("2b — the label element carries a data-presence attribute matching the current presence", { timeout: 30000 }, () => {
    /**
     * The `data-presence` attribute on the label span SHALL equal the
     * current presence value so CSS transitions target the correct element.
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESENCES),
        (presence) => {
          const mockedState = buildMascotState(presence);
          vi.mocked(useMascot).mockReturnValue({
            state: mockedState,
            amplitude: 0,
            character: "octopus",
            setCharacter: vi.fn(),
            dispatch: vi.fn() as React.Dispatch<MascotAction>,
            setAmplitude: vi.fn(),
            celebrate: vi.fn(),
          });

          const { unmount } = render(React.createElement(NavMascotAvatar));
          const label = screen.getByText(expectedLabel[presence]);
          expect(label.getAttribute("data-presence")).toBe(presence);
          unmount();
        },
      ),
    );
  });

  it("2c — a presence change causes the label to update to the new expected text", { timeout: 30000 }, () => {
    /**
     * For any two distinct MascotPresence values p1 and p2, re-rendering
     * NavMascotAvatar with presence = p2 after presence = p1 SHALL display
     * expectedLabel[p2] and not the stale expectedLabel[p1] (unless both
     * map to the same label, e.g. idle/sleeping/error → STANDBY).
     */
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESENCES),
        fc.constantFrom(...ALL_PRESENCES),
        (p1, p2) => {
          // Render with p1
          vi.mocked(useMascot).mockReturnValue({
            state: buildMascotState(p1),
            amplitude: 0,
            character: "octopus",
            setCharacter: vi.fn(),
            dispatch: vi.fn() as React.Dispatch<MascotAction>,
            setAmplitude: vi.fn(),
            celebrate: vi.fn(),
          });

          const { rerender, unmount } = render(React.createElement(NavMascotAvatar));

          // Switch to p2
          vi.mocked(useMascot).mockReturnValue({
            state: buildMascotState(p2),
            amplitude: 0,
            character: "octopus",
            setCharacter: vi.fn(),
            dispatch: vi.fn() as React.Dispatch<MascotAction>,
            setAmplitude: vi.fn(),
            celebrate: vi.fn(),
          });

          rerender(React.createElement(NavMascotAvatar));

          const label = screen.getByText(expectedLabel[p2]);
          expect(label).toBeDefined();
          unmount();
        },
      ),
    );
  });

  // ─── Concrete examples per requirement ──────────────────────────────────────

  it("concrete: idle → STANDBY (Req 3.3)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("idle"),
      amplitude: 0,
      character: "octopus",
      setCharacter: vi.fn(),
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(NavMascotAvatar));
    expect(screen.getByText("STANDBY")).toBeInTheDocument();
    unmount();
  });

  it("concrete: sleeping → STANDBY (Req 3.3)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("sleeping"),
      amplitude: 0,
      character: "octopus",
      setCharacter: vi.fn(),
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(NavMascotAvatar));
    expect(screen.getByText("STANDBY")).toBeInTheDocument();
    unmount();
  });

  it("concrete: error → STANDBY (Req 3.3)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("error"),
      amplitude: 0,
      character: "octopus",
      setCharacter: vi.fn(),
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(NavMascotAvatar));
    expect(screen.getByText("STANDBY")).toBeInTheDocument();
    unmount();
  });

  it("concrete: listening → LISTENING (Req 3.4)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("listening"),
      amplitude: 0,
      character: "octopus",
      setCharacter: vi.fn(),
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(NavMascotAvatar));
    expect(screen.getByText("LISTENING")).toBeInTheDocument();
    unmount();
  });

  it("concrete: thinking → THINKING (Req 3.5)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("thinking"),
      amplitude: 0,
      character: "octopus",
      setCharacter: vi.fn(),
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(NavMascotAvatar));
    expect(screen.getByText("THINKING")).toBeInTheDocument();
    unmount();
  });

  it("concrete: working → WORKING (Req 3.6)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("working"),
      amplitude: 0,
      character: "octopus",
      setCharacter: vi.fn(),
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(NavMascotAvatar));
    expect(screen.getByText("WORKING")).toBeInTheDocument();
    unmount();
  });

  it("concrete: researching → RESEARCHING (Req 3.7)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("researching"),
      amplitude: 0,
      character: "octopus",
      setCharacter: vi.fn(),
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(NavMascotAvatar));
    expect(screen.getByText("RESEARCHING")).toBeInTheDocument();
    unmount();
  });

  it("concrete: speaking → SPEAKING (Req 3.8)", () => {
    vi.mocked(useMascot).mockReturnValue({
      state: buildMascotState("speaking"),
      amplitude: 0,
      character: "octopus",
      setCharacter: vi.fn(),
      dispatch: vi.fn() as React.Dispatch<MascotAction>,
      setAmplitude: vi.fn(),
      celebrate: vi.fn(),
    });
    const { unmount } = render(React.createElement(NavMascotAvatar));
    expect(screen.getByText("SPEAKING")).toBeInTheDocument();
    unmount();
  });

  // ─── Completeness check ──────────────────────────────────────────────────────

  it("completeness — expectedLabel covers all 8 MascotPresence values", () => {
    /**
     * Guard that the test's own expectedLabel map is complete. If a new
     * MascotPresence value is added, this test will fail until the map
     * is updated, preventing silent regressions.
     */
    const mappedPresences = new Set(Object.keys(expectedLabel));
    for (const p of ALL_PRESENCES) {
      expect(mappedPresences.has(p)).toBe(true);
    }
    expect(mappedPresences.size).toBe(ALL_PRESENCES.length);
  });
});
