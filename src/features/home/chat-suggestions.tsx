"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const suggestions = [
  { label: "What should I study today?", href: "/flashcards" },
  { label: "Research AI tutors", href: "/research?question=How%20do%20AI%20tutors%20affect%20student%20learning%3F" },
  { label: "Debate a claim", href: "/debate?mode=debate" },
  { label: "Quiz me", href: "/quiz" },
  { label: "Make flashcards", href: "/flashcards" },
  { label: "Start a focus session", href: "/focus" },
] as const;

export function ChatSuggestions() {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef({ pointer: -1, x: 0, left: 0, moved: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) return;
      let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= el.clientWidth;
      if (!delta) return;
      const next = Math.min(max, Math.max(0, el.scrollLeft + delta));
      if (next === el.scrollLeft) return;
      el.scrollLeft = next;
      event.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || event.button !== 0) return;
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    drag.current = { pointer: event.pointerId, x: event.clientX, left: el.scrollLeft, moved: false };
    el.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = scroller.current;
    if (!el || drag.current.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.current.x;
    if (Math.abs(dx) > 4) {
      drag.current.moved = true;
      el.dataset.dragging = "true";
    }
    el.scrollLeft = drag.current.left - dx;
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const el = scroller.current;
    if (drag.current.pointer !== event.pointerId) return;
    drag.current.pointer = -1;
    if (el) delete el.dataset.dragging;
  }

  function onClickCapture(event: React.MouseEvent) {
    if (!drag.current.moved) return;
    drag.current.moved = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      aria-label="Suggested tools"
      className="chat-suggestions"
      onClickCapture={onClickCapture}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      ref={scroller}
    >
      {suggestions.map((item) => (
        <Link href={item.href} key={item.label}>{item.label}</Link>
      ))}
    </div>
  );
}
