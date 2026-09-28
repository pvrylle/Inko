"use client";

import type { VoiceMessage } from "@/features/voice/voice-types";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database.types";

const STORAGE_PREFIX = "inko.companion.sessions.";
const DELETED_PREFIX = "inko.companion.deleted.";
const UNSYNCED_PREFIX = "inko.companion.unsynced.";
const CHANGE_EVENT = "inko:companion-sessions-change";
const CLOUD_TIMEOUT_MS = 5000;
const CLOUD_PAGE_SIZE = 500;
const pendingWrites = new Map<string, Promise<unknown>>();
const syncIssues = new Map<string, Map<string, CompanionSessionSyncIssue>>();

export type CompanionSessionSyncIssue = {
  operation: "list" | "save" | "delete" | "configuration";
  kind: "offline" | "schema" | "permission" | "unconfigured" | "unknown";
  code: string | null;
  message: string;
  detail: string;
};

export type CompanionSession = {
  id: string;
  owner_id: string;
  title: string;
  messages: VoiceMessage[];
  research_session_id?: string | null;
  created_at: string;
  updated_at: string;
};

type SessionRow = Database["public"]["Tables"]["companion_sessions"]["Row"];
type DeletionMarker = { id: string; deleted_at: string; synced: boolean };
type BrowserSupabase = NonNullable<ReturnType<typeof getBrowserSupabaseClient>>;

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function deletedKey(userId: string) {
  return `${DELETED_PREFIX}${userId}`;
}

function unsyncedKey(userId: string) {
  return `${UNSYNCED_PREFIX}${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVoiceMessage(value: unknown): value is VoiceMessage {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.text !== "string" || typeof value.createdAt !== "string") return false;
  if (value.role !== "student" && value.role !== "inko") return false;
  if (value.interrupted !== undefined && typeof value.interrupted !== "boolean") return false;
  if (value.sources !== undefined && (!Array.isArray(value.sources) || !value.sources.every(
    (source) => isRecord(source) && typeof source.title === "string" && typeof source.url === "string",
  ))) return false;
  if (value.attachment !== undefined && (!isRecord(value.attachment) || typeof value.attachment.name !== "string" || typeof value.attachment.type !== "string")) return false;
  return true;
}

function messagesFromJson(value: unknown): VoiceMessage[] {
  return Array.isArray(value) ? value.filter(isVoiceMessage) : [];
}

function sessionFromRow(row: SessionRow): CompanionSession {
  return { ...row, messages: messagesFromJson(row.messages) };
}

function sessionFromLocal(value: unknown, userId: string): CompanionSession | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.owner_id !== userId || typeof value.title !== "string") return null;
  if (typeof value.created_at !== "string" || typeof value.updated_at !== "string") return null;
  return {
    id: value.id,
    owner_id: userId,
    title: value.title,
    messages: messagesFromJson(value.messages),
    research_session_id: typeof value.research_session_id === "string" ? value.research_session_id : null,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}

function readDeletions(userId: string): DeletionMarker[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(deletedKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is DeletionMarker =>
      isRecord(value) && typeof value.id === "string" && typeof value.deleted_at === "string" && typeof value.synced === "boolean",
    ) : [];
  } catch {
    return [];
  }
}

function writeDeletions(userId: string, deletions: DeletionMarker[]) {
  window.localStorage.setItem(deletedKey(userId), JSON.stringify(deletions));
}

function readUnsynced(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(unsyncedKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeUnsynced(userId: string, ids: Set<string>) {
  window.localStorage.setItem(unsyncedKey(userId), JSON.stringify([...ids]));
}

function sameSnapshot(a: CompanionSession, b: CompanionSession) {
  return a.updated_at === b.updated_at && a.title === b.title
    && (a.research_session_id ?? null) === (b.research_session_id ?? null)
    && JSON.stringify(a.messages) === JSON.stringify(b.messages);
}

function clearUnsyncedIfCurrent(userId: string, saved: CompanionSession) {
  const current = readLocal(userId).find((item) => item.id === saved.id);
  if (!current || !sameSnapshot(current, saved)) return;
  const ids = readUnsynced(userId);
  if (!ids.delete(saved.id)) return;
  writeUnsynced(userId, ids);
}

function readLocal(userId: string): CompanionSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const deleted = new Set(readDeletions(userId).map((item) => item.id));
    return Array.isArray(parsed)
      ? parsed.map((value) => sessionFromLocal(value, userId)).filter((value): value is CompanionSession => value !== null && !deleted.has(value.id))
      : [];
  } catch {
    return [];
  }
}

function notifyChange(userId: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { userId } }));
}

function issueFromError(operation: CompanionSessionSyncIssue["operation"], error: unknown): CompanionSessionSyncIssue {
  const value = isRecord(error) ? error : {};
  const code = typeof value.code === "string" ? value.code : null;
  const detail = error instanceof Error ? error.message : typeof value.message === "string" ? value.message : String(error);
  const status = typeof value.status === "number" ? value.status : null;
  let kind: CompanionSessionSyncIssue["kind"] = "unknown";
  if (operation === "configuration") kind = "unconfigured";
  else if (code === "42P01" || code === "PGRST205") kind = "schema";
  else if (code === "42501" || code === "28000" || status === 401 || status === 403) kind = "permission";
  else if (value.name === "AbortError" || /failed to fetch|network|offline|aborted/i.test(detail)) kind = "offline";
  const message = kind === "schema" ? "Cloud history is not ready yet. Conversations are saved on this device."
    : kind === "permission" ? "Cloud sync was denied. Conversations are saved on this device."
      : kind === "unconfigured" ? "Cloud sync is not configured. Conversations are saved on this device."
        : "Cloud sync is unavailable. Conversations are saved on this device.";
  return { operation, kind, code, message, detail };
}

function recordIssue(userId: string, key: string, operation: CompanionSessionSyncIssue["operation"], error: unknown) {
  const issue = issueFromError(operation, error);
  const issues = syncIssues.get(userId) ?? new Map<string, CompanionSessionSyncIssue>();
  if (JSON.stringify(issues.get(key)) === JSON.stringify(issue)) return;
  issues.delete(key);
  issues.set(key, issue);
  syncIssues.set(userId, issues);
  notifyChange(userId);
}

function clearIssue(userId: string, key: string) {
  const issues = syncIssues.get(userId);
  if (!issues?.delete(key)) return;
  if (issues.size === 0) syncIssues.delete(userId);
  notifyChange(userId);
}

export function getCompanionSessionSyncIssue(userId: string): CompanionSessionSyncIssue | null {
  const issues = syncIssues.get(userId);
  return issues ? [...issues.values()].at(-1) ?? null : null;
}

async function withCloudTimeout<T>(request: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("Cloud request timed out."), { name: "AbortError" }));
    }, CLOUD_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve(request(controller.signal)), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function writeLocal(userId: string, sessions: CompanionSession[]) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(sessions));
  notifyChange(userId);
}

function ordered(sessions: CompanionSession[]) {
  return sessions.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

function cloudClient(userId: string, isGuest: boolean) {
  if (isGuest) return null;
  const client = getBrowserSupabaseClient();
  if (!client) {
    recordIssue(userId, "configuration", "configuration", new Error("Supabase browser client is not configured."));
  }
  return client;
}

function queueWrite<T>(userId: string, sessionId: string, write: () => Promise<T>): Promise<T> {
  const key = `${userId}:${sessionId}`;
  const previous = pendingWrites.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(write);
  pendingWrites.set(key, next);
  const clear = () => {
    if (pendingWrites.get(key) === next) pendingWrites.delete(key);
  };
  void next.then(clear, clear);
  return next;
}

export function makeCompanionSession(userId: string, title = "New chat"): CompanionSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    owner_id: userId,
    title: title.trim().slice(0, 160) || "New chat",
    messages: [],
    research_session_id: null,
    created_at: now,
    updated_at: now,
  };
}

function scheduleCloudSave(userId: string, session: CompanionSession) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;
  void queueWrite(userId, session.id, async () => {
    try {
      const { error } = await withCloudTimeout((signal) => supabase
        .from("companion_sessions")
        .upsert({
          id: session.id,
          owner_id: userId,
          title: session.title,
          messages: session.messages as unknown as Json,
          research_session_id: session.research_session_id ?? null,
          created_at: session.created_at,
          updated_at: session.updated_at,
        }, { onConflict: "id" })
        .abortSignal(signal));
      if (error) throw error;
      clearUnsyncedIfCurrent(userId, session);
      clearIssue(userId, `save:${session.id}`);
    } catch (error) {
      recordIssue(userId, `save:${session.id}`, "save", error);
    }
  });
}

function scheduleCloudDelete(userId: string, sessionId: string) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;
  void queueWrite(userId, sessionId, async () => {
    try {
      const { error } = await withCloudTimeout((signal) => supabase
        .from("companion_sessions")
        .delete()
        .eq("owner_id", userId)
        .eq("id", sessionId)
        .abortSignal(signal));
      if (error) throw error;
      writeDeletions(userId, readDeletions(userId).map((item) => item.id === sessionId ? { ...item, synced: true } : item));
      clearIssue(userId, `delete:${sessionId}`);
    } catch (error) {
      recordIssue(userId, `delete:${sessionId}`, "delete", error);
    }
  });
}

async function readCloudSessions(supabase: BrowserSupabase, userId: string): Promise<CompanionSession[]> {
  const sessions: CompanionSession[] = [];
  for (let offset = 0; ; offset += CLOUD_PAGE_SIZE) {
    const { data, error } = await withCloudTimeout((signal) => supabase
      .from("companion_sessions")
      .select("id, owner_id, title, messages, research_session_id, created_at, updated_at")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + CLOUD_PAGE_SIZE - 1)
      .abortSignal(signal));
    if (error) throw error;
    sessions.push(...(data ?? []).map(sessionFromRow));
    if ((data ?? []).length < CLOUD_PAGE_SIZE) return sessions;
  }
}

async function readCloudSessionById(supabase: BrowserSupabase, userId: string, sessionId: string) {
  const { data, error } = await withCloudTimeout((signal) => supabase
    .from("companion_sessions")
    .select("id, owner_id, title, messages, research_session_id, created_at, updated_at")
    .eq("owner_id", userId)
    .eq("id", sessionId)
    .abortSignal(signal)
    .maybeSingle());
  if (error) throw error;
  return data ? sessionFromRow(data) : null;
}

async function assertCloudOwner(supabase: BrowserSupabase, userId: string) {
  const { data, error } = await withCloudTimeout(() => supabase.auth.getUser());
  if (error) throw error;
  if (data.user?.id !== userId) {
    throw Object.assign(new Error("The cloud account changed while loading conversation history."), { code: "28000" });
  }
}

export async function listCompanionSessions(userId: string, isGuest: boolean): Promise<CompanionSession[]> {
  const local = ordered(readLocal(userId));
  const supabase = cloudClient(userId, isGuest);
  if (!supabase) return local;

  try {
    const cloudRows = await readCloudSessions(supabase, userId);
    const listedIds = new Set(cloudRows.map((item) => item.id));
    const initiallyUnsynced = readUnsynced(userId);
    const missingSynced = readLocal(userId).filter((item) =>
      !listedIds.has(item.id) && !initiallyUnsynced.has(item.id) && !pendingWrites.has(`${userId}:${item.id}`),
    );
    if (missingSynced.length > 0) {
      // An empty RLS result can also mean the user signed out during the request.
      await assertCloudOwner(supabase, userId);
      const confirmedMissing: string[] = [];
      for (const item of missingSynced) {
        const found = await readCloudSessionById(supabase, userId, item.id);
        if (found) cloudRows.push(found);
        else confirmedMissing.push(item.id);
      }
      if (confirmedMissing.length > 0) await assertCloudOwner(supabase, userId);
      const stillUnsynced = readUnsynced(userId);
      const stillLocal = new Set(readLocal(userId).map((item) => item.id));
      const deletions = readDeletions(userId);
      const deletedIds = new Set(deletions.map((item) => item.id));
      const newlyDeleted = confirmedMissing.filter((id) =>
        stillLocal.has(id) && !stillUnsynced.has(id) && !pendingWrites.has(`${userId}:${id}`) && !deletedIds.has(id),
      );
      if (newlyDeleted.length > 0) {
        const now = new Date().toISOString();
        writeDeletions(userId, [...deletions, ...newlyDeleted.map((id) => ({ id, deleted_at: now, synced: true }))]);
      }
    }
    clearIssue(userId, "list");
    clearIssue(userId, "configuration");

    // Re-read after the request: a new message may have arrived while the cloud was responding.
    const latestLocal = readLocal(userId);
    const unsynced = readUnsynced(userId);
    const deletions = readDeletions(userId);
    const deletedIds = new Set(deletions.map((item) => item.id));
    const cloud = cloudRows.filter((item) => !deletedIds.has(item.id));
    const cloudById = new Map(cloud.map((item) => [item.id, item]));
    const merged = new Map(latestLocal.map((item) => [item.id, item]));
    for (const remote of cloud) {
      const current = merged.get(remote.id);
      if (!current || (!unsynced.has(remote.id) && !pendingWrites.has(`${userId}:${remote.id}`) && Date.parse(remote.updated_at) > Date.parse(current.updated_at))) {
        merged.set(remote.id, remote);
      }
    }
    const result = ordered([...merged.values()]);
    if (JSON.stringify(result) !== JSON.stringify(ordered(latestLocal))) writeLocal(userId, result);

    for (const item of result) {
      const remote = cloudById.get(item.id);
      if (!pendingWrites.has(`${userId}:${item.id}`) && (unsynced.has(item.id) || !remote || Date.parse(item.updated_at) > Date.parse(remote.updated_at))) {
        scheduleCloudSave(userId, item);
      }
    }
    for (const marker of deletions) {
      if (!pendingWrites.has(`${userId}:${marker.id}`) && (!marker.synced || cloudRows.some((item) => item.id === marker.id))) {
        scheduleCloudDelete(userId, marker.id);
      }
    }
    return result;
  } catch (error) {
    recordIssue(userId, "list", "list", error);
    return ordered(readLocal(userId));
  }
}

export async function getCompanionSession(
  userId: string,
  isGuest: boolean,
  sessionId: string,
): Promise<CompanionSession | null> {
  return (await listCompanionSessions(userId, isGuest)).find((session) => session.id === sessionId) ?? null;
}

export async function saveCompanionSession(
  userId: string,
  isGuest: boolean,
  session: CompanionSession,
): Promise<CompanionSession> {
  const now = new Date().toISOString();
  const saved: CompanionSession = {
    ...session,
    owner_id: userId,
    title: session.title.trim().slice(0, 160) || "New chat",
    messages: session.messages.filter(isVoiceMessage),
    research_session_id: session.research_session_id ?? null,
    updated_at: now,
  };

  if (!isGuest) {
    const unsynced = readUnsynced(userId);
    unsynced.add(saved.id);
    writeUnsynced(userId, unsynced);
  }
  writeDeletions(userId, readDeletions(userId).filter((item) => item.id !== saved.id));
  writeLocal(userId, ordered([saved, ...readLocal(userId).filter((item) => item.id !== saved.id)]));
  if (cloudClient(userId, isGuest)) scheduleCloudSave(userId, saved);
  return saved;
}

export async function deleteCompanionSession(userId: string, isGuest: boolean, sessionId: string): Promise<void> {
  writeDeletions(userId, [
    ...readDeletions(userId).filter((item) => item.id !== sessionId),
    { id: sessionId, deleted_at: new Date().toISOString(), synced: false },
  ]);
  writeLocal(userId, readLocal(userId).filter((session) => session.id !== sessionId));
  const unsynced = readUnsynced(userId);
  if (unsynced.delete(sessionId)) writeUnsynced(userId, unsynced);
  if (cloudClient(userId, isGuest)) scheduleCloudDelete(userId, sessionId);
}

export function subscribeToCompanionSessions(userId: string, callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = (event: Event) => {
    if ((event as CustomEvent<{ userId: string }>).detail?.userId === userId) callback();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(userId)) callback();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
