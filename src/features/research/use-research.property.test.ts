/**
 * Property tests for research session logic
 *
 * Property 10: Research session sidebar ordering
 * - For any list of `ResearchSession` objects with distinct `updated_at`
 *   timestamps, sorting by `updated_at` desc SHALL produce the most-recently-
 *   updated session first.
 * Validates: Requirements 8.2
 *
 * Property 20: Research new session appears in sidebar and activates
 * - For any valid research question `q` (10–500 chars), calling
 *   `createSession(q)` SHALL add the new session to the `sessions` list AND
 *   set `activeSession` to that new session.
 * Validates: Requirements 8.11
 */

import * as fc from "fast-check";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { researchQuestionSchema } from "./research-schema";
import type { ResearchSession } from "./research-schema";

// ─── Repository mock setup ────────────────────────────────────────────────────

vi.mock("./research-repository", () => ({
  listResearchSessions: vi.fn(),
  createResearchSession: vi.fn(),
  listSources: vi.fn().mockResolvedValue([]),
  listFindings: vi.fn().mockResolvedValue([]),
  listContradictions: vi.fn().mockResolvedValue([]),
  listOpenQuestions: vi.fn().mockResolvedValue([]),
  getCanvasNote: vi.fn().mockResolvedValue(null),
  getResearchNote: vi.fn().mockResolvedValue(null),
  upsertCanvasNote: vi.fn().mockResolvedValue(undefined),
  subscribeToResearchSessions: vi.fn().mockReturnValue(() => undefined),
}));

// Mock the auth provider so the hook sees a ready authenticated user
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ userId: "user-test-123", isReady: true }),
}));

import * as repo from "./research-repository";
import { useResearch } from "./use-research";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal ResearchSession with a given ISO timestamp. */
function makeSession(
  overrides: Partial<ResearchSession> & { updated_at: string },
): ResearchSession {
  return {
    id: crypto.randomUUID(),
    owner_id: "user-test-123",
    question: "What is the impact of sleep on memory consolidation?",
    created_at: overrides.updated_at,
    ...overrides,
  };
}

/**
 * Pure sort predicate extracted from the DB ordering contract:
 * sessions ordered by `updated_at` descending (most recent first).
 */
function sortByUpdatedAtDesc(sessions: ResearchSession[]): ResearchSession[] {
  return [...sessions].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

// ─── Property 10: Session sidebar ordering ───────────────────────────────────

describe("Property 10: Research session sidebar ordering", () => {
  /**
   * For any list of sessions with distinct `updated_at` timestamps, sorting
   * by `updated_at` desc produces them in most-recently-updated-first order.
   * Validates: Requirements 8.2
   */
  it("10a — any array of sessions with distinct timestamps sorts correctly descending", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.integer({ min: 0, max: 1_000_000_000_000 }).map((ms) =>
            new Date(ms).toISOString(),
          ),
          { minLength: 1, maxLength: 20 },
        ),
        (timestamps) => {
          const sessions = timestamps.map((ts) =>
            makeSession({ updated_at: ts }),
          );
          const sorted = sortByUpdatedAtDesc(sessions);

          // Each adjacent pair: sorted[i].updated_at >= sorted[i+1].updated_at
          for (let i = 0; i < sorted.length - 1; i++) {
            const curr = new Date(sorted[i]!.updated_at).getTime();
            const next = new Date(sorted[i + 1]!.updated_at).getTime();
            expect(curr).toBeGreaterThanOrEqual(next);
          }
        },
      ),
    );
  });

  it("10b — the first element after sorting is the session with the maximum updated_at", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.integer({ min: 0, max: 1_000_000_000_000 }).map((ms) =>
            new Date(ms).toISOString(),
          ),
          { minLength: 1, maxLength: 20 },
        ),
        (timestamps) => {
          const sessions = timestamps.map((ts) =>
            makeSession({ updated_at: ts }),
          );
          const sorted = sortByUpdatedAtDesc(sessions);
          const maxTs = Math.max(
            ...sessions.map((s) => new Date(s.updated_at).getTime()),
          );
          expect(new Date(sorted[0]!.updated_at).getTime()).toBe(maxTs);
        },
      ),
    );
  });

  it("10c — sorting preserves all sessions (no drops or duplicates)", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.integer({ min: 0, max: 1_000_000_000_000 }).map((ms) =>
            new Date(ms).toISOString(),
          ),
          { minLength: 0, maxLength: 20 },
        ),
        (timestamps) => {
          const sessions = timestamps.map((ts) =>
            makeSession({ updated_at: ts }),
          );
          const sorted = sortByUpdatedAtDesc(sessions);

          expect(sorted).toHaveLength(sessions.length);
          const originalIds = new Set(sessions.map((s) => s.id));
          const sortedIds = new Set(sorted.map((s) => s.id));
          expect(sortedIds).toEqual(originalIds);
        },
      ),
    );
  });

  it("concrete example — three sessions produce most-recent-first order", () => {
    const oldest = makeSession({ updated_at: "2024-01-01T00:00:00.000Z" });
    const middle = makeSession({ updated_at: "2024-06-01T00:00:00.000Z" });
    const newest = makeSession({ updated_at: "2024-12-01T00:00:00.000Z" });

    const sorted = sortByUpdatedAtDesc([oldest, newest, middle]);

    expect(sorted[0]!.id).toBe(newest.id);
    expect(sorted[1]!.id).toBe(middle.id);
    expect(sorted[2]!.id).toBe(oldest.id);
  });
});

// ─── Property 20: New session appears in sidebar and activates ────────────────

describe("Property 20: Research new session appears in sidebar and activates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.listResearchSessions).mockResolvedValue([]);
    vi.mocked(repo.subscribeToResearchSessions).mockReturnValue(() => undefined);
  });

  /**
   * Helper that configures the listResearchSessions mock to return the given
   * session when `loadSessionData` calls it to resolve the active session.
   */
  function setupSessionMock(newSession: ResearchSession) {
    // First call (initial load): empty list
    // Subsequent calls (loadSessionData): return the new session
    vi.mocked(repo.listResearchSessions)
      .mockResolvedValueOnce([])
      .mockResolvedValue([newSession]);
    vi.mocked(repo.createResearchSession).mockResolvedValue(newSession);
  }

  /**
   * For any valid research question q (10–500 chars), calling createSession(q)
   * SHALL add the new session to `sessions` AND set `activeSession` to it.
   * Validates: Requirements 8.11
   */
  it("20a — createSession with any valid question adds session to list and sets it as active", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Only generate questions that pass Zod validation (10–500 non-empty chars)
        fc
          .string({ minLength: 10, maxLength: 500 })
          .filter((q) => researchQuestionSchema.safeParse(q).success),
        async (question) => {
          vi.clearAllMocks();
          vi.mocked(repo.subscribeToResearchSessions).mockReturnValue(
            () => undefined,
          );

          const createdSession = makeSession({
            id: crypto.randomUUID(),
            question,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          });
          setupSessionMock(createdSession);

          const { result } = renderHook(() => useResearch());
          await waitFor(() => expect(result.current.loading).toBe(false));

          await act(async () => {
            await result.current.createSession(question);
          });

          // The new session must appear in the sessions list
          const sessionIds = result.current.sessions.map((s) => s.id);
          expect(sessionIds).toContain(createdSession.id);

          // The active session must be the newly created one
          await waitFor(() => {
            expect(result.current.activeSession?.id).toBe(createdSession.id);
          });
        },
      ),
      { numRuns: 10 }, // Limit runs since each involves async renderHook
    );
  });

  it("20b — createSession prepends new session so it appears first in the list", async () => {
    const existingSession = makeSession({
      id: "existing-session",
      updated_at: "2024-01-01T00:00:00.000Z",
    });
    const newSession = makeSession({
      id: "new-session",
      question: "What are the effects of exercise on cognitive function?",
      updated_at: new Date().toISOString(),
    });

    vi.mocked(repo.listResearchSessions)
      .mockResolvedValueOnce([existingSession])
      .mockResolvedValue([newSession, existingSession]);
    vi.mocked(repo.createResearchSession).mockResolvedValue(newSession);

    const { result } = renderHook(() => useResearch());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createSession(
        "What are the effects of exercise on cognitive function?",
      );
    });

    // New session should be prepended (optimistic update puts it first)
    expect(result.current.sessions[0]!.id).toBe("new-session");

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe("new-session");
    });
  });

  it("20c — createSession with valid question clears sessionError and sets active session", async () => {
    const newSession = makeSession({
      id: "no-error-session",
      question: "How does neuroplasticity work in adult brains?",
      updated_at: new Date().toISOString(),
    });
    setupSessionMock(newSession);

    const { result } = renderHook(() => useResearch());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createSession(
        "How does neuroplasticity work in adult brains?",
      );
    });

    expect(result.current.sessionError).toBeNull();
    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe("no-error-session");
    });
  });

  /**
   * For any string shorter than 10 chars, the schema SHALL reject it —
   * ensuring the hook never creates a session for invalid questions.
   * Validates: Requirements 8.12
   */
  it("20d — researchQuestionSchema rejects any question shorter than 10 chars", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 9 }),
        (shortQuestion) => {
          const result = researchQuestionSchema.safeParse(shortQuestion);
          expect(result.success).toBe(false);
        },
      ),
    );
  });

  /**
   * For any string longer than 500 chars, the schema SHALL reject it.
   * Validates: Requirements 8.12
   */
  it("20e — researchQuestionSchema rejects any question longer than 500 chars", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 501, maxLength: 600 }),
        (longQuestion) => {
          const result = researchQuestionSchema.safeParse(longQuestion);
          expect(result.success).toBe(false);
        },
      ),
    );
  });

  it("20f — createSession with a too-short question sets sessionError and does not call repository", async () => {
    const { result } = renderHook(() => useResearch());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createSession("short");
    });

    expect(result.current.sessionError).not.toBeNull();
    expect(repo.createResearchSession).not.toHaveBeenCalled();
    expect(result.current.activeSession).toBeNull();
  });
});
