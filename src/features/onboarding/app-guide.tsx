"use client";

import { useEffect, useState } from "react";

const GUIDE_KEY = "inko.guide.v1";

export function hasSeenAppGuide(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(GUIDE_KEY) === "1";
}

export function markAppGuideSeen() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUIDE_KEY, "1");
}

export function AppGuide({
  step,
  onOpenChat,
  onNext,
  onDone,
}: {
  step: 0 | 1 | 2;
  onOpenChat: () => void;
  onNext: () => void;
  onDone: () => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;

  const steps = [
    {
      place: "button" as const,
      kicker: "Step 1 of 3",
      title: "Try the Inko chat",
      body: "This blue button is easy to miss. It opens a chat you can use on every page, not only here.",
      action: "Open Inko",
      onAction: onOpenChat,
    },
    {
      place: "panel" as const,
      kicker: "Step 2 of 3",
      title: "This chat stays with you",
      body: "Ask a question from this panel while you research, debate, or review cards.",
      action: "Next",
      onAction: onNext,
    },
    {
      place: "composer" as const,
      kicker: "Step 3 of 3",
      title: "Or type in the box below",
      body: "The home page has its own message box. Use the Inko button when you leave this page.",
      action: "Got it",
      onAction: onDone,
    },
  ];
  const current = steps[step];

  return (
    <div className="app-guide" data-step={current.place}>
      <div className="app-guide-scrim" />
      <section className="app-guide-card" data-place={current.place} aria-labelledby="app-guide-title">
        <span>{current.kicker}</span>
        <h2 id="app-guide-title">{current.title}</h2>
        <p>{current.body}</p>
        <div>
          <button type="button" onClick={current.onAction}>{current.action}</button>
          {step < 2 ? <button type="button" onClick={onDone}>Skip</button> : null}
        </div>
      </section>
    </div>
  );
}
