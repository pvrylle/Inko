/**
 * Property tests for mascot state machine — sequential Jarvis-style workflow
 *
 * Property 18: Sequential workflow messages
 * For any starting mascot state, dispatching the sequential actions:
 *   USER_STARTED → USER_STOPPED → WORK_STARTED(planning) → RESEARCH_STARTED
 *   → WORK_STARTED(organising) → AGENT_AUDIO → REPLY_DONE
 * SHALL produce the following presence+message at each step:
 *   1. listening  / "I'm listening…"
 *   2. thinking   / "Let me understand that."
 *   3. working    / "Planning the approach."
 *   4. researching/ "I'm comparing the evidence."
 *   5. working    / "Organising the findings."
 *   6. speaking   / "Here's what I found."
 *   7. idle       / "What should we do next?"
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import * as fc from "fast-check";
import { mascotReducer, initialMascotState, type MascotMode, type MascotMood, type MascotState } from "./mascot-state";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** All possible starting states covering the full presence × mood × mode matrix */
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
  mood: fc.constantFrom<MascotMood>("neutral", "happy", "encouraging"),
  emotion: fc.constantFrom("neutral", "happy", "curious", "focused", "concerned", "encouraging"),
  mode: fc.constantFrom<MascotMode>("normal", "focus"),
  message: fc.string(),
});

/** Run the full 7-action Jarvis workflow from a given starting state */
function runFullWorkflow(start: MascotState) {
  const s1 = mascotReducer(start, { type: "USER_STARTED" });
  const s2 = mascotReducer(s1, { type: "USER_STOPPED" });
  const s3 = mascotReducer(s2, { type: "WORK_STARTED", label: "Planning the approach." });
  const s4 = mascotReducer(s3, { type: "RESEARCH_STARTED" });
  const s5 = mascotReducer(s4, { type: "WORK_STARTED", label: "Organising the findings." });
  const s6 = mascotReducer(s5, { type: "AGENT_AUDIO" });
  const s7 = mascotReducer(s6, { type: "REPLY_DONE" });
  return [s1, s2, s3, s4, s5, s6, s7] as const;
}

// ─── Concrete example test ────────────────────────────────────────────────────

describe("Property 18: Sequential workflow messages", () => {
  it("concrete — full 7-action workflow from initialMascotState produces correct presence+message at each step", () => {
    const [s1, s2, s3, s4, s5, s6, s7] = runFullWorkflow(initialMascotState);

    // Step 1 — USER_STARTED (Req 10.1)
    expect(s1.presence).toBe("listening");
    expect(s1.message).toBe("I'm listening…");

    // Step 2 — USER_STOPPED (Req 10.2)
    expect(s2.presence).toBe("thinking");
    expect(s2.message).toBe("Let me understand that.");

    // Step 3 — WORK_STARTED "Planning the approach." (Req 10.3)
    expect(s3.presence).toBe("working");
    expect(s3.message).toBe("Planning the approach.");

    // Step 4 — RESEARCH_STARTED (Req 10.4)
    expect(s4.presence).toBe("researching");
    expect(s4.message).toBe("I'm comparing the evidence.");

    // Step 5 — WORK_STARTED "Organising the findings." (Req 10.5)
    expect(s5.presence).toBe("working");
    expect(s5.message).toBe("Organising the findings.");

    // Step 6 — AGENT_AUDIO (Req 10.6)
    expect(s6.presence).toBe("speaking");
    expect(s6.message).toBe("Here's what I found.");

    // Step 7 — REPLY_DONE (Req 10.7)
    expect(s7.presence).toBe("idle");
    expect(s7.message).toBe("What should we do next?");
  });

  // ─── Property 18 ─────────────────────────────────────────────────────────────

  it("18 — for any starting state, the full workflow produces correct presence+message at every step", () => {
    /**
     * **Validates: Requirements 10.3, 10.4, 10.5, 10.6, 10.7**
     *
     * Regardless of the initial mascot state (any presence, mood, mode, or
     * message), running the full Jarvis workflow SHALL always converge to the
     * canonical presence+message sequence defined by the requirements.
     *
     * Note: REPLY_DONE message is mode-dependent — normal mode yields
     * "What should we do next?" and focus mode yields "You've got this."
     * The property tests steps 1–6 unconditionally and step 7 conditionally
     * on the mode carried through the workflow.
     */
    fc.assert(
      fc.property(arbitraryMascotState, (start) => {
        const [s1, s2, s3, s4, s5, s6, s7] = runFullWorkflow(start);

        // Step 1
        expect(s1.presence).toBe("listening");
        expect(s1.message).toBe("I'm listening…");

        // Step 2
        expect(s2.presence).toBe("thinking");
        expect(s2.message).toBe("Let me understand that.");

        // Step 3 — Req 10.3
        expect(s3.presence).toBe("working");
        expect(s3.message).toBe("Planning the approach.");

        // Step 4 — Req 10.4
        expect(s4.presence).toBe("researching");
        expect(s4.message).toBe("I'm comparing the evidence.");

        // Step 5 — Req 10.5
        expect(s5.presence).toBe("working");
        expect(s5.message).toBe("Organising the findings.");

        // Step 6 — Req 10.6
        expect(s6.presence).toBe("speaking");
        expect(s6.message).toBe("Here's what I found.");

        // Step 7 — Req 10.7
        // REPLY_DONE message depends on mode (carried unchanged through all prior steps)
        const expectedIdleMessage =
          start.mode === "focus" ? "You've got this." : "What should we do next?";
        expect(s7.presence).toBe("idle");
        expect(s7.message).toBe(expectedIdleMessage);
      }),
    );
  });

  // ─── Mode preservation across the full workflow ────────────────────────────

  it("18 — workflow preserves mode (normal/focus) throughout every step", () => {
    /**
     * None of the seven workflow actions change `mode`, so the mode at every
     * intermediate step SHALL equal the starting mode.
     */
    fc.assert(
      fc.property(arbitraryMascotState, (start) => {
        const [s1, s2, s3, s4, s5, s6, s7] = runFullWorkflow(start);
        const expectedMode = start.mode;

        expect(s1.mode).toBe(expectedMode);
        expect(s2.mode).toBe(expectedMode);
        expect(s3.mode).toBe(expectedMode);
        expect(s4.mode).toBe(expectedMode);
        expect(s5.mode).toBe(expectedMode);
        expect(s6.mode).toBe(expectedMode);
        expect(s7.mode).toBe(expectedMode);
      }),
    );
  });

  // ─── Individual transition tests ──────────────────────────────────────────

  it("planning transition — WORK_STARTED 'Planning the approach.' from any thinking state", () => {
    /**
     * Any state arriving from USER_STOPPED (presence=thinking) transitions
     * correctly to working with the planning message.
     * Validates: Req 10.3
     */
    fc.assert(
      fc.property(
        fc.record({
          presence: fc.constant("thinking" as const),
          mood: fc.constantFrom<MascotMood>("neutral", "happy", "encouraging"),
          emotion: fc.constantFrom("neutral", "happy", "curious", "focused", "concerned", "encouraging"),
          mode: fc.constantFrom<MascotMode>("normal", "focus"),
          message: fc.string(),
        }),
        (thinkingState) => {
          const next = mascotReducer(thinkingState, {
            type: "WORK_STARTED",
            label: "Planning the approach.",
          });
          expect(next.presence).toBe("working");
          expect(next.message).toBe("Planning the approach.");
        },
      ),
    );
  });

  it("researching transition — RESEARCH_STARTED from any working state sets researching + canonical message", () => {
    /**
     * Any state with presence=working transitions to researching with the
     * canonical "I'm comparing the evidence." message.
     * Validates: Req 10.4
     */
    fc.assert(
      fc.property(
        fc.record({
          presence: fc.constant("working" as const),
          mood: fc.constantFrom<MascotMood>("neutral", "happy", "encouraging"),
          emotion: fc.constantFrom("neutral", "happy", "curious", "focused", "concerned", "encouraging"),
          mode: fc.constantFrom<MascotMode>("normal", "focus"),
          message: fc.string(),
        }),
        (workingState) => {
          const next = mascotReducer(workingState, { type: "RESEARCH_STARTED" });
          expect(next.presence).toBe("researching");
          expect(next.message).toBe("I'm comparing the evidence.");
        },
      ),
    );
  });

  it("organising transition — WORK_STARTED 'Organising the findings.' from any researching state", () => {
    /**
     * Any state arriving from RESEARCH_STARTED (presence=researching) transitions
     * correctly to working with the organising message.
     * Validates: Req 10.5
     */
    fc.assert(
      fc.property(
        fc.record({
          presence: fc.constant("researching" as const),
          mood: fc.constantFrom<MascotMood>("neutral", "happy", "encouraging"),
          emotion: fc.constantFrom("neutral", "happy", "curious", "focused", "concerned", "encouraging"),
          mode: fc.constantFrom<MascotMode>("normal", "focus"),
          message: fc.string(),
        }),
        (researchingState) => {
          const next = mascotReducer(researchingState, {
            type: "WORK_STARTED",
            label: "Organising the findings.",
          });
          expect(next.presence).toBe("working");
          expect(next.message).toBe("Organising the findings.");
        },
      ),
    );
  });

  it("speaking transition — AGENT_AUDIO from any working state sets speaking + canonical message", () => {
    /**
     * Any state with presence=working (organising phase) transitions to
     * speaking with "Here's what I found." on AGENT_AUDIO.
     * Validates: Req 10.6
     */
    fc.assert(
      fc.property(
        fc.record({
          presence: fc.constant("working" as const),
          mood: fc.constantFrom<MascotMood>("neutral", "happy", "encouraging"),
          emotion: fc.constantFrom("neutral", "happy", "curious", "focused", "concerned", "encouraging"),
          mode: fc.constantFrom<MascotMode>("normal", "focus"),
          message: fc.string(),
        }),
        (workingState) => {
          const next = mascotReducer(workingState, { type: "AGENT_AUDIO" });
          expect(next.presence).toBe("speaking");
          expect(next.message).toBe("Here's what I found.");
        },
      ),
    );
  });

  it("idle transition — REPLY_DONE from speaking in normal mode produces 'What should we do next?'", () => {
    /**
     * Speaking state in normal mode → REPLY_DONE → idle with the
     * "What should we do next?" message.
     * Validates: Req 10.7
     */
    fc.assert(
      fc.property(
        fc.record({
          presence: fc.constant("speaking" as const),
          mood: fc.constantFrom<MascotMood>("neutral", "happy", "encouraging"),
          emotion: fc.constantFrom("neutral", "happy", "curious", "focused", "concerned", "encouraging"),
          mode: fc.constant("normal" as const),
          message: fc.string(),
        }),
        (speakingState) => {
          const next = mascotReducer(speakingState, { type: "REPLY_DONE" });
          expect(next.presence).toBe("idle");
          expect(next.message).toBe("What should we do next?");
        },
      ),
    );
  });

  // ─── Concrete example: focus mode preserves message on REPLY_DONE ──────────

  it("concrete — in focus mode REPLY_DONE uses focus message 'You've got this.'", () => {
    /**
     * The REPLY_DONE handler branches on `state.mode`. In focus mode it returns
     * "You've got this." rather than "What should we do next?".
     * This test documents the known behaviour; the workflow property above
     * always starts in the mode of the generated starting state, but the main
     * property uses a mixed-mode starting state. The final REPLY_DONE step in
     * the overall property may produce either message depending on mode — the
     * property correctly threads the mode through.
     */
    const focusStart: MascotState = {
      presence: "speaking",
      mood: "neutral",
      emotion: "neutral",
      mode: "focus",
      message: "Here's what I found.",
    };
    const next = mascotReducer(focusStart, { type: "REPLY_DONE" });
    expect(next.presence).toBe("idle");
    expect(next.message).toBe("You've got this.");
  });
});
