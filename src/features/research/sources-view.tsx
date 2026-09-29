"use client";

import { ArrowRight, FolderOpen } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { useResearch } from "./use-research";

function relativeTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SourcesView() {
  const { sessions, loading } = useResearch();

  return (
    <div className="content-page page-enter">
      <PageHeading
        eyebrow="Research"
        title="Sources"
        description="Every source Inko has gathered, grouped by research project."
      />

      {loading ? (
        <div className="library-loading" aria-busy="true"><span /><span /><span /><p>Loading your sources…</p></div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No sources yet" message="Start a research project and Inko will collect and tag sources for you." action={<Link className="primary-button" href="/research">Start research</Link>} />
      ) : (
        <div className="source-collection-grid">
          {sessions.map((session) => (
            <Link className="source-collection" href={`/research?session=${session.id}&tab=sources`} key={session.id}>
              <span className="source-collection-icon"><FolderOpen size={18} /></span>
              <div><strong>{session.question}</strong><small>Updated {relativeTime(session.updated_at)}</small></div>
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
