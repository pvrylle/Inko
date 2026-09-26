/**
 * Property tests for mascot overlay visibility predicate
 *
 * Property 4: Overlay visibility matches presence
 * - For any MascotPresence value `p`, `shouldShowOverlay` SHALL return true
 *   if and only if `p ∈ { "working", "researching" }`.
 *
 * Validates: Requirements 5.1, 5.4
 *
 * Note: MascotOverlay (task 4.1) does not exist yet. This test validates the
 * pure predicate logic that the component will use to decide its visibility.
 * The same `shouldShowOverlay` function will be imported and used in the
 * component once it is created.
 */

import * as fc from "fast-check";
import {
  mascotReducer,
  initialMascotState,
  type MascotMood,
  type MascotPresence,
  type MascotState,
} from "./mascot-state";
import { shouldShowOverlay } from "./mascot-overlay";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OVERLAY_PRESENCES = new Set<MascotPresence>(["working", "researching"]);

const NON_OVERLAY_PRESENCES: MascotPresence[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "sleeping",
  "error",
];

/** Arbitrary that generates any valid MascotState */
const arbitraryMascotState: fc.Arbitrary<MascotState> = fc.record({
  presence: fc.constantFrom<MascotPresence>(
    "idle",
    "listening",
    "thinking",
    "speaking",
    "sleeping",
    "error",
    "working",
    "researching",
  ),
  mood: fc.constantFrom("neutral", "happy", "encouraging"),
  emotion: fc.constantFrom("neutral", "happy", "curious", "focused", "concerned", "encouraging"),
  mode: fc.constantFrom("normal", "focus"),
  message: fc.string(),
});

// ─── Property 4: Overlay visibility matches presence ─────────────────────────

describe("Property 4: Overlay visibility matches presence", () => {
  it("4a — shouldShowOverlay returns true for every overlay presence", () => {
    /**
     * For all states where presence ∈ { "working", "researching" },
     * shouldShowOverlay SHALL return true.
     */
    fc.assert(
      fc.property(
        arbitraryMascotState.filter((s) => OVERLAY_PRESENCES.has(s.presence)),
        (state) => {
          expect(shouldShowOverlay(state)).toBe(true);
        },
      ),
    );
  });

  it("4b — shouldShowOverlay returns false for every non-overlay presence", () => {
    /**
     * For all states where presence ∉ { "working", "researching" },
     * shouldShowOverlay SHALL return false.
     */
    fc.assert(
      fc.property(
        arbitraryMascotState.filter((s) => !OVERLAY_PRESENCES.has(s.presence)),
        (state) => {
          expect(shouldShowOverlay(state)).toBe(false);
        },
      ),
    );
  });

  it("4c — shouldShowOverlay is exhaustive: true iff presence is working or researching", () => {
    /**
     * Universal property across all possible MascotStates: the predicate
     * returns true if and only if presence is one of the two overlay values.
     * No other state fields (mood, mode, message) affect the result.
     */
    fc.assert(
      fc.property(arbitraryMascotState, (state) => {
        const result = shouldShowOverlay(state);
        const expected = state.presence === "working" || state.presence === "researching";
        expect(result).toBe(expected);
      }),
    );
  });

  it("4d — message and mood do not affect overlay visibility", () => {
    /**
     * For any two states that share the same presence, shouldShowOverlay
     * SHALL return the same value regardless of message or mood.
     */
    fc.assert(
      fc.property(
        arbitraryMascotState,
        fc.string(),
        fc.constantFrom<MascotMood>("neutral", "happy", "encouraging"),
        (state, message, mood) => {
          const variant: MascotState = { ...state, message, mood };
          expect(shouldShowOverlay(variant)).toBe(shouldShowOverlay(state));
        },
      ),
    );
  });

  // ─── Concrete examples from Requirements 5.1 / 5.4 ─────────────────────────

  it("concrete — RESEARCH_STARTED action produces overlay-visible state", () => {
    const state = mascotReducer(initialMascotState, { type: "RESEARCH_STARTED" });
    expect(state.presence).toBe("researching");
    expect(shouldShowOverlay(state)).toBe(true);
  });

  it("concrete — WORK_STARTED action produces overlay-visible state", () => {
    const state = mascotReducer(initialMascotState, { type: "WORK_STARTED" });
    expect(state.presence).toBe("working");
    expect(shouldShowOverlay(state)).toBe(true);
  });

  it("concrete — REPLY_DONE after working transitions to idle (overlay hidden)", () => {
    const working = mascotReducer(initialMascotState, { type: "WORK_STARTED" });
    const idle = mascotReducer(working, { type: "REPLY_DONE" });
    expect(idle.presence).toBe("idle");
    expect(shouldShowOverlay(idle)).toBe(false);
  });

  it("concrete — REPLY_DONE after researching transitions to idle (overlay hidden)", () => {
    const researching = mascotReducer(initialMascotState, { type: "RESEARCH_STARTED" });
    const idle = mascotReducer(researching, { type: "REPLY_DONE" });
    expect(idle.presence).toBe("idle");
    expect(shouldShowOverlay(idle)).toBe(false);
  });

  it.each(NON_OVERLAY_PRESENCES)(
    "concrete — presence '%s' yields shouldShowOverlay = false",
    (presence) => {
      const state: MascotState = { ...initialMascotState, presence };
      expect(shouldShowOverlay(state)).toBe(false);
    },
  );

  it.each(Array.from(OVERLAY_PRESENCES))(
    "concrete — presence '%s' yields shouldShowOverlay = true",
    (presence) => {
      const state: MascotState = { ...initialMascotState, presence };
      expect(shouldShowOverlay(state)).toBe(true);
    },
  );
});
