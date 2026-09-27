"use client";

import { Mic, X } from "lucide-react";
import { useState } from "react";
import { VoiceCapsule } from "./voice-capsule";

export function PageVoiceControl({ label = "Talk with Inko" }: { label?: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        className="page-voice-toggle"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Mic size={16} />
        {label}
      </button>
    );
  }

  return (
    <div className="page-voice-panel">
      <div className="page-voice-panel-head">
        <strong>Optional voice</strong>
        <button aria-label="Close voice" className="page-voice-close" onClick={() => setOpen(false)} type="button">
          <X size={16} />
        </button>
      </div>
      <p>Use this only when you want to talk. Everything else on the page still works by typing and tapping.</p>
      <VoiceCapsule />
    </div>
  );
}
