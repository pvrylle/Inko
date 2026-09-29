"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type PageBriefKind = "debate" | "research" | "quiz" | "flashcards" | "focus";

export interface PageBrief {
  kind: PageBriefKind;
  /** Short label displayed under the chat title in the panel */
  label: string;
  /** Brief text appended to the chat request; not saved into the transcript */
  detail: string;
}

interface PageBriefContext {
  brief: PageBrief | null;
  setBrief: (brief: PageBrief | null) => void;
}

const Ctx = createContext<PageBriefContext | null>(null);

export function PageBriefProvider({ children }: { children: React.ReactNode }) {
  const [brief, setBriefState] = useState<PageBrief | null>(null);
  const setBrief = useCallback((next: PageBrief | null) => setBriefState(next), []);
  const value = useMemo(() => ({ brief, setBrief }), [brief, setBrief]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePageBrief() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePageBrief must be used within PageBriefProvider");
  return ctx;
}

/**
 * Publish a brief while this component is mounted. The brief is cleared on
 * unmount and re-published whenever `brief` changes. Pass `null` to suppress.
 */
export function usePublishBrief(brief: PageBrief | null) {
  const { setBrief } = usePageBrief();
  // Use stable refs so the effect deps are just the serialised content string.
  const setBriefRef = useRef(setBrief);
  setBriefRef.current = setBrief;
  const briefRef = useRef(brief);
  briefRef.current = brief;

  const trigger = brief ? `${brief.kind}|${brief.label}|${brief.detail}` : null;

  useEffect(() => {
    setBriefRef.current(briefRef.current);
    return () => { setBriefRef.current(null); };
    // Only re-run when the serialised content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
}
