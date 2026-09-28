import type { VoiceMessage } from "@/features/voice/voice-types";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  deleteCompanionSession,
  getCompanionSession,
  getCompanionSessionSyncIssue,
  listCompanionSessions,
  saveCompanionSession,
  subscribeToCompanionSessions,
  type CompanionSession,
} from "./companion-sessions";

vi.mock("@/lib/supabase/client", () => ({ getBrowserSupabaseClient: vi.fn(() => null) }));

const browserClient = vi.mocked(getBrowserSupabaseClient);

function useCloud(options: {
  rows?: CompanionSession[];
  listError?: { code: string; message: string };
  saveError?: { code: string; message: string };
  deleteError?: { code: string; message: string };
  authenticatedUserId?: string;
}) {
  let lookupId: string | null = null;
  let rangeStart = 0;
  let rangeEnd = 499;
  const listBuilder = {
    eq: vi.fn((column: string, value: string) => {
      if (column === "id") lookupId = value;
      return listBuilder;
    }),
    order: vi.fn().mockReturnThis(),
    range: vi.fn((start: number, end: number) => {
      rangeStart = start;
      rangeEnd = end;
      return listBuilder;
    }),
    maybeSingle: vi.fn(async () => ({
      data: options.rows?.find((row) => row.id === lookupId) ?? null,
      error: options.listError ?? null,
    })),
    abortSignal: vi.fn(() => lookupId ? listBuilder : Promise.resolve({
      data: (options.rows ?? []).slice(rangeStart, rangeEnd + 1),
      error: options.listError ?? null,
    })),
  };
  const saveBuilder = { abortSignal: vi.fn(async () => ({ data: null, error: options.saveError ?? null })) };
  const deleteBuilder = {
    eq: vi.fn().mockReturnThis(),
    abortSignal: vi.fn(async () => ({ data: null, error: options.deleteError ?? null })),
  };
  const from = vi.fn(() => ({
    select: vi.fn(() => {
      lookupId = null;
      rangeStart = 0;
      rangeEnd = 499;
      return listBuilder;
    }),
    upsert: vi.fn(() => saveBuilder),
    delete: vi.fn(() => deleteBuilder),
  }));
  const auth = { getUser: vi.fn(async () => ({
    data: { user: { id: options.authenticatedUserId ?? options.rows?.[0]?.owner_id ?? null } },
    error: null,
  })) };
  browserClient.mockReturnValue({ from, auth } as unknown as NonNullable<ReturnType<typeof getBrowserSupabaseClient>>);
  return { from, listBuilder, saveBuilder, deleteBuilder };
}

const question: VoiceMessage = {
  id: "message-1",
  role: "student",
  text: "Help me plan a study session",
  createdAt: "2026-09-28T10:00:00.000Z",
};

const answer: VoiceMessage = {
  id: "message-2",
  role: "inko",
  text: "Let's start with your hardest topic.",
  createdAt: "2026-09-28T10:00:01.000Z",
  sources: [{ title: "Study guide", url: "https://example.com/guide" }],
};

function session(ownerId: string): CompanionSession {
  return {
    id: "session-1",
    owner_id: ownerId,
    title: "Study planning",
    messages: [question, answer],
    research_session_id: "research-1",
    created_at: "2026-09-28T10:00:00.000Z",
    updated_at: "2026-09-28T10:00:00.000Z",
  };
}

describe("companion sessions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    browserClient.mockReset();
    browserClient.mockReturnValue(null);
  });

  it("resumes saved messages and sources after a fresh read", async () => {
    await saveCompanionSession("guest-a", true, session("guest-a"));

    const loaded = await getCompanionSession("guest-a", true, "session-1");
    expect(loaded?.title).toBe("Study planning");
    expect(loaded?.messages).toEqual([question, answer]);
    expect(loaded?.research_session_id).toBe("research-1");

    await saveCompanionSession("guest-a", true, {
      ...loaded!,
      messages: [...loaded!.messages, { id: "message-3", role: "student", text: "Start with biology", createdAt: "2026-09-28T10:00:02.000Z" }],
    });
    expect(await listCompanionSessions("guest-a", true)).toHaveLength(1);
    expect((await getCompanionSession("guest-a", true, "session-1"))?.messages).toHaveLength(3);
  });

  it("keeps guest conversations separate and reports deletion", async () => {
    const changes = vi.fn();
    const unsubscribe = subscribeToCompanionSessions("guest-a", changes);

    await saveCompanionSession("guest-a", true, session("guest-a"));
    await saveCompanionSession("guest-b", true, session("guest-b"));
    expect(await listCompanionSessions("guest-a", true)).toHaveLength(1);
    expect(await listCompanionSessions("guest-b", true)).toHaveLength(1);
    expect(changes).toHaveBeenCalledTimes(1);

    await deleteCompanionSession("guest-a", true, "session-1");
    expect(await listCompanionSessions("guest-a", true)).toEqual([]);
    expect(await listCompanionSessions("guest-b", true)).toHaveLength(1);
    expect(changes).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("keeps signed-in chats locally when the cloud table is not available", async () => {
    useCloud({
      listError: { code: "PGRST205", message: "Table missing from schema cache" },
      saveError: { code: "PGRST205", message: "Table missing from schema cache" },
    });

    const saved = await saveCompanionSession("account-a", false, session("account-a"));
    expect(saved.messages).toEqual([question, answer]);
    expect((await listCompanionSessions("account-a", true))[0]?.messages).toEqual([question, answer]);
    expect(await listCompanionSessions("account-a", false)).toHaveLength(1);
    await vi.waitFor(() => expect(getCompanionSessionSyncIssue("account-a")?.kind).toBe("schema"));

    const recovered = useCloud({ rows: [] });
    expect(await listCompanionSessions("account-a", false)).toHaveLength(1);
    await vi.waitFor(() => expect(recovered.saveBuilder.abortSignal).toHaveBeenCalled());
    await vi.waitFor(() => expect(getCompanionSessionSyncIssue("account-a")).toBeNull());
  });

  it("merges cloud and device histories by the latest update time", async () => {
    const localNewer = { ...session("account-merge"), id: "local-newer", title: "Local version" };
    const cloudNewer = { ...session("account-merge"), id: "cloud-newer", title: "Local old version" };
    await saveCompanionSession("account-merge", true, localNewer);
    await saveCompanionSession("account-merge", true, cloudNewer);

    useCloud({ rows: [
      { ...localNewer, title: "Cloud old version", updated_at: "2020-01-01T00:00:00.000Z" },
      { ...cloudNewer, title: "Cloud latest version", updated_at: "2099-01-01T00:00:00.000Z" },
      { ...session("account-merge"), id: "cloud-only", title: "Other device", updated_at: "2025-01-01T00:00:00.000Z" },
    ] });

    const merged = await listCompanionSessions("account-merge", false);
    expect(merged).toHaveLength(3);
    expect(merged.find((item) => item.id === "local-newer")?.title).toBe("Local version");
    expect(merged.find((item) => item.id === "cloud-newer")?.title).toBe("Cloud latest version");
    expect(merged.find((item) => item.id === "cloud-only")?.title).toBe("Other device");
    expect(await listCompanionSessions("account-merge", true)).toEqual(merged);
  });

  it("keeps an unsynced newer turn when an older server row has a later timestamp", async () => {
    const owner = "account-unsynced";
    const older = session(owner);
    await saveCompanionSession(owner, true, older);
    const latestTurn: VoiceMessage = {
      id: "message-3",
      role: "student",
      text: "Let's work on biology next.",
      createdAt: "2026-09-28T10:00:02.000Z",
    };
    const olderServerCopy = { ...older, updated_at: "2099-01-01T00:00:00.000Z" };
    const unavailable = useCloud({
      rows: [olderServerCopy],
      saveError: { code: "", message: "Failed to fetch" },
    });

    await saveCompanionSession(owner, false, { ...older, messages: [...older.messages, latestTurn] });
    await vi.waitFor(() => expect(getCompanionSessionSyncIssue(owner)?.kind).toBe("offline"));

    const afterFailedSync = await listCompanionSessions(owner, false);
    expect(afterFailedSync[0]?.messages).toEqual([question, answer, latestTurn]);
    expect((await listCompanionSessions(owner, true))[0]?.messages).toEqual([question, answer, latestTurn]);
    await vi.waitFor(() => expect(unavailable.saveBuilder.abortSignal).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const recovered = useCloud({ rows: [olderServerCopy] });
    expect((await listCompanionSessions(owner, false))[0]?.messages).toHaveLength(3);
    await vi.waitFor(() => expect(recovered.saveBuilder.abortSignal).toHaveBeenCalled());
    await vi.waitFor(() => expect(getCompanionSessionSyncIssue(owner)).toBeNull());

    const newerServerCopy = { ...older, title: "Edited on another device", updated_at: "2100-01-01T00:00:00.000Z" };
    useCloud({ rows: [newerServerCopy] });
    expect((await listCompanionSessions(owner, false))[0]?.title).toBe("Edited on another device");
  });

  it("removes a synced chat deleted remotely but retains a new unsynced chat", async () => {
    const owner = "account-remote-delete";
    const existing = session(owner);
    const cloudRows = [existing];
    const cloud = useCloud({ rows: cloudRows, authenticatedUserId: owner });
    await saveCompanionSession(owner, false, existing);
    await vi.waitFor(() => expect(cloud.saveBuilder.abortSignal).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(window.localStorage.getItem(`inko.companion.unsynced.${owner}`)).toBe("[]"));

    cloudRows.splice(0);
    expect(await listCompanionSessions(owner, false)).toEqual([]);
    expect(await listCompanionSessions(owner, true)).toEqual([]);
    expect(cloud.saveBuilder.abortSignal).toHaveBeenCalledTimes(1);

    useCloud({
      rows: [],
      authenticatedUserId: owner,
      saveError: { code: "", message: "Failed to fetch" },
    });
    await saveCompanionSession(owner, false, { ...existing, id: "new-offline-chat" });
    await vi.waitFor(() => expect(getCompanionSessionSyncIssue(owner)?.kind).toBe("offline"));
    expect((await listCompanionSessions(owner, false)).map((item) => item.id)).toEqual(["new-offline-chat"]);
  });

  it("does not treat an empty result for another account as remote deletion", async () => {
    const owner = "account-auth-changed";
    const existing = session(owner);
    await saveCompanionSession(owner, true, existing);
    useCloud({ rows: [], authenticatedUserId: "someone-else" });

    expect((await listCompanionSessions(owner, false)).map((item) => item.id)).toEqual([existing.id]);
    expect((await listCompanionSessions(owner, true)).map((item) => item.id)).toEqual([existing.id]);
    expect(getCompanionSessionSyncIssue(owner)?.kind).toBe("permission");
  });

  it("checks every cloud page before considering a cached chat deleted", async () => {
    const owner = "account-many-chats";
    const cloudRows = Array.from({ length: 501 }, (_, index) => ({
      ...session(owner),
      id: `session-${index}`,
    }));
    await saveCompanionSession(owner, true, cloudRows[500]);
    const cloud = useCloud({ rows: cloudRows, authenticatedUserId: owner });

    const loaded = await listCompanionSessions(owner, false);
    expect(loaded).toHaveLength(501);
    expect(loaded.some((item) => item.id === "session-500")).toBe(true);
    expect(cloud.listBuilder.range).toHaveBeenCalledWith(500, 999);
  });

  it("does not resurrect a locally deleted chat when cloud deletion fails", async () => {
    const existing = session("account-delete");
    await saveCompanionSession("account-delete", true, existing);
    useCloud({
      rows: [existing],
      deleteError: { code: "42501", message: "permission denied" },
    });

    await deleteCompanionSession("account-delete", false, existing.id);
    expect(await listCompanionSessions("account-delete", false)).toEqual([]);
    await vi.waitFor(() => expect(getCompanionSessionSyncIssue("account-delete")?.kind).toBe("permission"));
    expect(await listCompanionSessions("account-delete", true)).toEqual([]);
  });
});
