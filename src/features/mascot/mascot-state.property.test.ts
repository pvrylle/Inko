/**
 * Property tests for mascot state machine — `WORK_STARTED` label propagation
 *
 * Property 3: WORK_STARTED message follows label
 * - For any string `label`, dispatching { type: "WORK_STARTED", label } SHALL
 *   produce presence = "working" and message = label.
 * - Dispatching { type: "WORK_STARTED" } with no label SHALL produce
 *   message = "Working on it…"
 *
 * Validates: Requirements 4.2, 4.3
 */

import * as fc from "fast-check";
import { mascotReducer, initialMascotState, type MascotState } from "./mascot-state";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** All possible starting states Inko can be in (presence × mood × mode matrix) */
const arbitraryMascotState: fc.Arbitrary<MascotState> = fc.record({
  presence: fc.constantFrom(
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
  mode: fc.constantFrom("normal", "focus"),
  message: fc.string(),
});

// ─── Property 3a: WORK_STARTED with label ─────────────────────────────────────

describe("Property 3: WORK_STARTED message follows label", () => {
  it("3a — dispatching WORK_STARTED with any label string produces presence=working and message=label", () => {
    /**
     * For any string `label` and any starting state, the reducer SHALL
     * set presence to "working" and message to the provided label.
     */
    fc.assert(
      fc.property(
        arbitraryMascotState,
        fc.string(),
        (state, label) => {
          const next = mascotReducer(state, { type: "WORK_STARTED", label });

          expect(next.presence).toBe("working");
          expect(next.message).toBe(label);
        },
      ),
    );
  });

  it("3b — dispatching WORK_STARTED with no label produces presence=working and message='Working on it…'", () => {
    /**
     * For any starting state, dispatching WORK_STARTED without a label SHALL
     * produce presence = "working" and message = "Working on it…"
     */
    fc.assert(
      fc.property(arbitraryMascotState, (state) => {
        const next = mascotReducer(state, { type: "WORK_STARTED" });

        expect(next.presence).toBe("working");
        expect(next.message).toBe("Working on it…");
      }),
    );
  });

  it("3c — WORK_STARTED does not mutate other state fields (mode, mood)", () => {
    /**
     * The reducer is a pure function; WORK_STARTED SHALL only change
     * presence and message, leaving mode and mood unchanged.
     */
    fc.assert(
      fc.property(
        arbitraryMascotState,
        fc.option(fc.string(), { nil: undefined }),
        (state, label) => {
          const action =
            label !== undefined
              ? ({ type: "WORK_STARTED", label } as const)
              : ({ type: "WORK_STARTED" } as const);

          const next = mascotReducer(state, action);

          expect(next.mode).toBe(state.mode);
          expect(next.mood).toBe(state.mood);
        },
      ),
    );
  });

  // ─── Specific examples from Requirements 4.2 / 4.3 ─────────────────────────

  it("concrete example — initial state + WORK_STARTED with label", () => {
    const label = "Planning the approach.";
    const next = mascotReducer(initialMascotState, { type: "WORK_STARTED", label });
    expect(next.presence).toBe("working");
    expect(next.message).toBe("Planning the approach.");
  });

  it("concrete example — initial state + WORK_STARTED with no label falls back", () => {
    const next = mascotReducer(initialMascotState, { type: "WORK_STARTED" });
    expect(next.presence).toBe("working");
    expect(next.message).toBe("Working on it…");
  });

  it("concrete example — WORK_STARTED preserves focus mode", () => {
    const focusState = mascotReducer(initialMascotState, {
      type: "SET_MODE",
      mode: "focus",
    });
    const next = mascotReducer(focusState, {
      type: "WORK_STARTED",
      label: "Organising the findings.",
    });
    expect(next.presence).toBe("working");
    expect(next.message).toBe("Organising the findings.");
    expect(next.mode).toBe("focus");
  });
});
