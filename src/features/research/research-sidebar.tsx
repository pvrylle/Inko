"use client";

import { FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { ResearchSession } from "./research-schema";
import { ResearchSessionForm } from "./research-session-form";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  sessions: ResearchSession[];
  activeSession: ResearchSession | null;
  setActive: (id: string) => void;
  createSession: (question: string) => Promise<void>;
  sessionError: string | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Sidebar for the Research page.
 *
 * - Lists all Research Sessions ordered by `updated_at` descending
 *   (Requirement 8.2).
 * - Clicking a session row calls `setActive(session.id)` (Requirement 8.3).
 * - Renders `ResearchSessionForm` at the top for creating new sessions.
 * - Shows an empty state when no sessions exist (Requirement 8.9).
 */
export function ResearchSidebar({
  sessions,
  activeSession,
  setActive,
  createSession,
  sessionError,
}: Props) {
  const [showForm, setShowForm] = useState(false);

  // Sort sessions by updated_at descending so the most-recently-updated
  // session appears first (Requirement 8.2). We sort a shallow copy to avoid
  // mutating the array owned by the hook.
  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [sessions],
  );

  const handleCreateSession = async (question: string) => {
    await createSession(question);
    setShowForm(false);
  };

  return (
    <aside className="research-sidebar" aria-label="Research sessions">
      {/* ── New session trigger ────────────────────────────────────────── */}
      <div className="research-sidebar-header">
        <h2 className="research-sidebar-title">Sessions</h2>
        <button
          aria-expanded={showForm}
          className="secondary-button research-sidebar-new"
          onClick={() => setShowForm((prev) => !prev)}
          type="button"
        >
          {showForm ? "Cancel" : "New session"}
        </button>
      </div>

      {/* ── New session form (toggled) ─────────────────────────────────── */}
      {showForm && (
        <div className="research-sidebar-form-wrap">
          <ResearchSessionForm
            createSession={handleCreateSession}
            sessionError={sessionError}
          />
        </div>
      )}

      {/* ── Session list ───────────────────────────────────────────────── */}
      {sortedSessions.length === 0 ? (
        <div className="research-sidebar-empty">
          <EmptyState
            icon={FlaskConical}
            title="No research sessions yet"
            message="Start a new session to begin organising sources, findings, and open questions."
          />
        </div>
      ) : (
        <nav aria-label="Research session list">
          <ul className="research-session-list" role="list">
            {sortedSessions.map((session) => {
              const isActive = session.id === activeSession?.id;
              const updatedDate = new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
              }).format(new Date(session.updated_at));

              return (
                <li key={session.id}>
                  <button
                    aria-current={isActive ? "true" : undefined}
                    className="research-session-item"
                    data-active={isActive ? "true" : undefined}
                    onClick={() => setActive(session.id)}
                    type="button"
                  >
                    <span className="research-session-question">
                      {session.question}
                    </span>
                    <time
                      className="research-session-date"
                      dateTime={session.updated_at}
                    >
                      {updatedDate}
                    </time>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </aside>
  );
}
