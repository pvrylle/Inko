"use client";

import { InkoMascot } from "./inko-mascot";
import { useMascot } from "./mascot-provider";
import type { MascotPresence } from "./mascot-state";

const presenceLabel: Record<MascotPresence, string> = {
  idle:        "STANDBY",
  sleeping:    "STANDBY",
  error:       "STANDBY",
  listening:   "LISTENING",
  thinking:    "THINKING",
  speaking:    "SPEAKING",
  working:     "WORKING",
  researching: "RESEARCHING",
};

export function NavMascotAvatar() {
  const { state } = useMascot();
  return (
    <div className="nav-mascot" aria-hidden="true">
      <div className="nav-mascot-sprite">
        {/* No interaction handlers — non-interactive in nav position (Req 3.10) */}
        <InkoMascot state={state} className="nav-mascot-inko" fit="cover" />
      </div>
      <span className="nav-mascot-label" data-presence={state.presence}>
        {presenceLabel[state.presence]}
      </span>
    </div>
  );
}
