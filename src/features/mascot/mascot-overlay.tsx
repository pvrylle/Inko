"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMascot } from "./mascot-provider";
import { InkoMascot } from "./inko-mascot";
import type { MascotState } from "./mascot-state";

// ─── Visibility predicate ─────────────────────────────────────────────────────

/**
 * Determines whether the MascotOverlay should be present in the DOM.
 * Returns true iff `state.presence` is "working" or "researching".
 */
export function shouldShowOverlay(state: MascotState): boolean {
  return state.presence === "working" || state.presence === "researching";
}

// ─── Component ────────────────────────────────────────────────────────────────

const OVERLAY_PRESENCES = new Set(["working", "researching"]);

/**
 * Full-screen Jarvis-style overlay rendered when Inko is actively working or
 * researching. Uses AnimatePresence + motion.div for a 300 ms fade-out on exit.
 *
 * Requirements: 5.1 (fixed layer above content), 5.2 (≥ 200 × 200 px mascot),
 * 5.3 (message beneath mascot), 5.4 (fade-out ≤ 300 ms), 5.5 (≥ 40 % backdrop),
 * 5.6 (aria-live="polite" message region).
 */
export function MascotOverlay() {
  const { state, amplitude } = useMascot();
  const visible = OVERLAY_PRESENCES.has(state.presence);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="mascot-overlay"
          className="mascot-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          role="status"
        >
          {/* Semi-transparent backdrop — ≥ 40 % opacity (Req 5.5) */}
          <div className="mascot-overlay-backdrop" aria-hidden="true" />

          {/* Centred stage: large InkoMascot + message */}
          <div className="mascot-overlay-stage">
            {/* InkoMascot at minimum 200 × 200 px (Req 5.2) */}
            <InkoMascot
              state={state}
              amplitude={amplitude}
              className="mascot-overlay-large"
              fit="cover"
            />

            {/* Message region — accessible to screen readers (Req 5.3, 5.6) */}
            <div
              className="mascot-overlay-message"
              aria-live="polite"
              aria-atomic="true"
            >
              {state.message}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
