/**
 * Property tests for MascotOverlay message round-trip (Property 5)
 *
 * Property 5: Overlay message round-trip
 * - For any non-empty message string `m`, when `mascotReducer` is in state
 *   { presence: "working", message: m }, the MascotOverlay SHALL render `m`
 *   inside the `aria-live="polite"` region.
 *
 * Validates: Requirements 5.3, 5.6
 *
 * Testing approach:
 * The round-trip is split into two verifiable legs.
 *
 * Leg A (pure reducer logic — no DOM):
 *   WORK_STARTED { label: m }
 *     → mascotReducer produces { presence: "working", message: m }
 *     → shouldShowOverlay(state) === true
 *     → state.message === m  ✓
 *
 * Leg B (render round-trip — DOM via @testing-library/react):
 *   State { presence: "working", message: m } injected via mocked useMascot()
 *     → MascotOverlay renders
 *     → the aria-live="polite" region contains exactly m  ✓
 *
 * Both legs are exercised with fast-check over arbitrary non-empty strings.
 */

import * as fc from "fast-check";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { vi, afterEach } from "vitest";
import {
  mascotReducer,
  initialMascotState,
  type MascotState,
} from "./mascot-state";
import { shouldShowOverlay, MascotOverlay } from "./mascot-overlay";

// ─── Module-level mocks ───────────────────────────────────────────────────────
// vi.mock() calls are hoisted by vitest's transformer, so they run before the
// imports above.  Static imports of the mocked modules then receive the mock.

// Replace the animated mascot SVG with a lightweight stub so render tests stay
// fast and focused on the message region.
vi.mock("./inko-mascot", () => ({
  InkoMascot: ({ state }: { state: MascotState }) =>
    React.createElement("div", {
      "data-testid": "inko-mascot-stub",
      "data-presence": state.presence,
    }),
}));

// Replace AnimatePresence / motion.div with plain React equivalents so jsdom
// does not need framer-motion's ResizeObserver dependency.
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  motion: {
    div: ({
      children,
      className,
      role,
      "aria-modal": ariaModal,
    }: React.HTMLAttributes<HTMLDivElement> & { "aria-modal"?: string }) =>
      React.createElement(
        "div",
        { className, role, "aria-modal": ariaModal },
        children,
      ),
  },
}));

// Mock useMascot so we can inject arbitrary MascotState without mounting the
// full MascotProvider (which wires up window event listeners and timers).
const mockUseMascot = vi.fn();
vi.mock("./mascot-provider", () => ({
  useMascot: () => mockUseMascot(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Build a working-presence MascotState with the given message. */
function workingState(message: string): MascotState {
  return { presence: "working", mood: "neutral", emotion: "focused", mode: "normal", message };
}

/** Inject a MascotState into the mock and render MascotOverlay. */
function renderOverlay(state: MascotState) {
  mockUseMascot.mockReturnValue({
    state,
    amplitude: 0,
    character: "octopus",
    setCharacter: vi.fn(),
    dispatch: vi.fn(),
    setAmplitude: vi.fn(),
    celebrate: vi.fn(),
  });
  return render(React.createElement(MascotOverlay));
}

// ─── All possible starting states (for Leg A) ────────────────────────────────

const arbitraryAnyMascotState: fc.Arbitrary<MascotState> = fc.record({
  presence: fc.constantFrom(
    "idle" as const,
    "listening" as const,
    "thinking" as const,
    "speaking" as const,
    "sleeping" as const,
    "error" as const,
    "working" as const,
    "researching" as const,
  ),
  mood: fc.constantFrom("neutral" as const, "happy" as const, "encouraging" as const),
  emotion: fc.constantFrom(
    "neutral" as const,
    "happy" as const,
    "curious" as const,
    "focused" as const,
    "concerned" as const,
    "encouraging" as const,
  ),
  mode: fc.constantFrom("normal" as const, "focus" as const),
  message: fc.string(),
});

// ─── Leg A: Pure reducer round-trip ──────────────────────────────────────────

describe("Property 5 — Leg A: reducer round-trip (pure logic)", () => {
  it("5a — WORK_STARTED { label: m } produces presence=working, message=m, shouldShowOverlay=true", () => {
    /**
     * For any non-empty string m and any starting state, dispatching
     * WORK_STARTED { label: m } SHALL produce a state where:
     *   • presence === "working"
     *   • message === m
     *   • shouldShowOverlay(next) === true
     *
     * This is the reducer leg of the round-trip (Requirement 5.3, 5.6).
     */
    fc.assert(
      fc.property(
        arbitraryAnyMascotState,
        fc.string({ minLength: 1 }),
        (state, m) => {
          const next = mascotReducer(state, { type: "WORK_STARTED", label: m });

          expect(next.presence).toBe("working");
          expect(next.message).toBe(m);
          expect(shouldShowOverlay(next)).toBe(true);
        },
      ),
    );
  });

  it("5b — shouldShowOverlay returns true iff presence ∈ { working, researching }", () => {
    /**
     * shouldShowOverlay is the visibility predicate used by MascotOverlay.
     * It SHALL return true for exactly "working" and "researching".
     */
    const overlayPresences = new Set(["working", "researching"]);

    fc.assert(
      fc.property(arbitraryAnyMascotState, (state) => {
        const result = shouldShowOverlay(state);
        expect(result).toBe(overlayPresences.has(state.presence));
      }),
    );
  });

  it("5c — state.message is preserved for any working state (identity check)", () => {
    /**
     * The minimal precondition for Leg B: if a state has presence=working
     * and message=m, then shouldShowOverlay(state) is true and message is m.
     */
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (m) => {
        const state = workingState(m);
        expect(shouldShowOverlay(state)).toBe(true);
        expect(state.message).toBe(m);
      }),
    );
  });

  // Concrete examples from Requirements 5.3 / 5.6

  it("concrete — 'Planning the approach.' round-trip via reducer", () => {
    const label = "Planning the approach.";
    const next = mascotReducer(initialMascotState, { type: "WORK_STARTED", label });
    expect(next.presence).toBe("working");
    expect(next.message).toBe(label);
    expect(shouldShowOverlay(next)).toBe(true);
  });

  it("concrete — 'Organising the findings.' round-trip via reducer", () => {
    const label = "Organising the findings.";
    const next = mascotReducer(initialMascotState, { type: "WORK_STARTED", label });
    expect(next.presence).toBe("working");
    expect(next.message).toBe(label);
    expect(shouldShowOverlay(next)).toBe(true);
  });
});

// ─── Leg B: Render round-trip ─────────────────────────────────────────────────

describe("Property 5 — Leg B: render round-trip (MascotOverlay DOM)", () => {
  it("5d — MascotOverlay renders m in the aria-live region for any non-empty message", { timeout: 30000 }, () => {
    /**
     * For any non-empty string m, when MascotOverlay is given state
     * { presence: "working", message: m }, the aria-live="polite" region SHALL
     * contain m (Requirement 5.3, 5.6).
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (m) => {
          renderOverlay(workingState(m));

          const liveRegion = screen.getByRole("status");
          expect(liveRegion).toBeInTheDocument();

          const messageEl = liveRegion.querySelector("[aria-live='polite']");
          expect(messageEl).not.toBeNull();
          expect(messageEl!.textContent).toBe(m);

          cleanup();
        },
      ),
    );
  });

  it("5e — overlay is not in the DOM when presence is not working/researching", () => {
    /**
     * MascotOverlay SHALL NOT render when presence is outside
     * { working, researching }, so no aria-live message leaks.
     */
    const nonOverlayPresences: MascotState["presence"][] = [
      "idle", "listening", "thinking", "speaking", "sleeping", "error",
    ];

    for (const presence of nonOverlayPresences) {
      renderOverlay({ presence, mood: "neutral", emotion: "neutral", mode: "normal", message: "should not render" });
      expect(screen.queryByRole("status")).toBeNull();
      cleanup();
    }
  });

  // Concrete render examples

  it("concrete render — 'Planning the approach.' appears in aria-live region", () => {
    const message = "Planning the approach.";
    renderOverlay(workingState(message));

    const liveRegion = screen.getByRole("status");
    const messageEl = liveRegion.querySelector("[aria-live='polite']");
    expect(messageEl?.textContent).toBe(message);
  });

  it("concrete render — 'I'm comparing the evidence.' (researching state) appears in aria-live region", () => {
    const message = "I'm comparing the evidence.";
    const state: MascotState = { presence: "researching", mood: "neutral", emotion: "focused", mode: "normal", message };
    renderOverlay(state);

    const liveRegion = screen.getByRole("status");
    const messageEl = liveRegion.querySelector("[aria-live='polite']");
    expect(messageEl?.textContent).toBe(message);
  });
});
