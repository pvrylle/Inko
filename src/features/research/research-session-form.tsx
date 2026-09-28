"use client";

import { useState } from "react";
import { researchQuestionSchema } from "./research-schema";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  /** Async handler provided by `useResearch()`; called only when validation passes. */
  createSession: (question: string) => Promise<unknown>;
  /** Validation / server error surfaced by the hook (null when none). */
  sessionError: string | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Form for creating a new Research Session.
 *
 * Validates the research question client-side using `researchQuestionSchema`
 * (10–500 chars) before calling `createSession`. Inline error is shown on
 * submit when validation fails, satisfying Requirements 8.10, 8.11, and 8.12.
 */
export function ResearchSessionForm({ createSession, sessionError }: Props) {
  const [question, setQuestion] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Surface the most-specific error: local validation beats the hook error
  const displayError = localError ?? sessionError;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Client-side Zod validation (Requirement 8.12)
    const result = researchQuestionSchema.safeParse(question.trim());
    if (!result.success) {
      const issue = result.error.issues[0];
      if (issue?.code === "too_small") {
        setLocalError("Research question must be at least 10 characters.");
      } else if (issue?.code === "too_big") {
        setLocalError("Research question must be 500 characters or fewer.");
      } else {
        setLocalError("Please enter a valid research question.");
      }
      return;
    }

    setLocalError(null);
    setSubmitting(true);
    try {
      await createSession(question.trim());
      setQuestion(""); // reset on success
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="research-session-form" onSubmit={(e) => void handleSubmit(e)}>
      <label className="research-session-label" htmlFor="research-question">
        New research question
      </label>

      <textarea
        className="research-session-input"
        id="research-question"
        maxLength={500}
        minLength={10}
        onChange={(e) => {
          setQuestion(e.target.value);
          // Clear local error as user types so feedback is not stale
          if (localError) setLocalError(null);
        }}
        placeholder="e.g. How does sleep deprivation affect memory consolidation?"
        rows={3}
        value={question}
      />

      <div className="research-session-meta">
        <span
          className="research-session-count"
          data-over={question.length > 500 ? "true" : undefined}
          aria-hidden="true"
        >
          {question.length}/500
        </span>

        <button
          className="primary-button research-session-submit"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Gathering sources…" : "Start research"}
        </button>
      </div>

      {displayError && (
        <p className="form-error" role="alert">
          {displayError}
        </p>
      )}
    </form>
  );
}
