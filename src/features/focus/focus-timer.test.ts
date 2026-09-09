import { describe, expect, it } from "vitest";
import { createFocusSession, focusProgress, formatFocusTime, reconcileFocusSession, remainingFocusSeconds, transitionFocusSession } from "./focus-timer";

describe("persistent focus timer math", () => {
  const start = new Date("2026-09-09T10:00:00.000Z");

  it("derives remaining time from persisted timestamps", () => {
    const session = createFocusSession("00000000-0000-4000-8000-000000000001", 25, start, "00000000-0000-4000-8000-000000000002");
    expect(remainingFocusSeconds(session, start.getTime() + 65_000)).toBe(1_435);
    expect(focusProgress(session, start.getTime())).toBe(100);
    expect(formatFocusTime(65)).toBe("01:05");
  });

  it("freezes while paused and shifts the target on resume", () => {
    const session = createFocusSession("00000000-0000-4000-8000-000000000001", 25, start);
    const paused = transitionFocusSession(session, "pause", new Date(start.getTime() + 60_000)).session!;
    expect(remainingFocusSeconds(paused, start.getTime() + 600_000)).toBe(1_440);
    const resumed = transitionFocusSession(paused, "resume", new Date(start.getTime() + 180_000)).session!;
    expect(Date.parse(resumed.target_ends_at)).toBe(Date.parse(session.target_ends_at) + 120_000);
    expect(resumed.accumulated_pause_seconds).toBe(120);
  });

  it("reconciles a sleeping browser at the original target", () => {
    const session = createFocusSession("00000000-0000-4000-8000-000000000001", 1, start);
    const reconciled = reconcileFocusSession(session, new Date(start.getTime() + 90_000));
    expect(reconciled.changed).toBe(true);
    expect(reconciled.session.status).toBe("completed");
    expect(reconciled.session.completed_at).toBe(session.target_ends_at);
  });

  it("makes terminal sessions immutable", () => {
    const session = { ...createFocusSession("00000000-0000-4000-8000-000000000001", 1, start), status: "cancelled" as const };
    expect(transitionFocusSession(session, "resume", new Date()).transition).toBe("no_open_session");
  });
});
