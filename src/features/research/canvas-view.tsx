"use client";

import { ArrowRight, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { PageVoiceControl } from "@/features/voice/page-voice-control";
import { useResearch } from "./use-research";

export function CanvasView() {
  const { sessions, loading } = useResearch();

  return (
    <div className="content-page page-enter">
      <PageHeading eyebrow="Research" title="Canvas" description="Open the working canvas for any research project to arrange arguments and notes." action={<PageVoiceControl />} />

      {loading ? (
        <div className="library-loading" aria-busy="true"><span /><span /><span /><p>Loading your canvases…</p></div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No canvases yet" message="Create a research project to open a canvas for arranging your findings." action={<Link className="primary-button" href="/research">Start research</Link>} />
      ) : (
        <div className="source-collection-grid">
          {sessions.map((session) => (
            <Link className="source-collection" href={`/research?session=${session.id}&tab=canvas`} key={session.id}>
              <span className="source-collection-icon" data-tone="purple"><LayoutGrid size={18} /></span>
              <div><strong>{session.question}</strong><small>Open canvas</small></div>
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
