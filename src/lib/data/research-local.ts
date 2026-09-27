"use client";

import type {
  CanvasNote,
  OpenQuestion,
  ResearchContradiction,
  ResearchFinding,
  ResearchNote,
  ResearchSession,
  ResearchSource,
} from "@/features/research/research-schema";

const PREFIX = "inko.research.projects.";
const CHANGE_EVENT = "inko:research-local-change";

export type ResearchProject = {
  session: ResearchSession;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  contradictions: ResearchContradiction[];
  openQuestions: OpenQuestion[];
  note: ResearchNote | null;
  canvas: CanvasNote | null;
};

function storageKey(userId: string) {
  return `${PREFIX}${userId}`;
}

function readAll(userId: string): ResearchProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as ResearchProject[]) : [];
  } catch {
    return [];
  }
}

function writeAll(userId: string, projects: ResearchProject[]) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(projects));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { userId } }));
}

export function listLocalResearchProjects(userId: string): ResearchProject[] {
  return readAll(userId).sort(
    (a, b) => Date.parse(b.session.updated_at) - Date.parse(a.session.updated_at),
  );
}

export function getLocalResearchProject(userId: string, sessionId: string) {
  return readAll(userId).find((project) => project.session.id === sessionId) ?? null;
}

export function saveLocalResearchProject(userId: string, project: ResearchProject) {
  const projects = readAll(userId).filter((item) => item.session.id !== project.session.id);
  writeAll(userId, [project, ...projects]);
  return project;
}

export function upsertLocalResearchSession(userId: string, session: ResearchSession) {
  const existing = getLocalResearchProject(userId, session.id);
  return saveLocalResearchProject(userId, {
    session,
    sources: existing?.sources ?? [],
    findings: existing?.findings ?? [],
    contradictions: existing?.contradictions ?? [],
    openQuestions: existing?.openQuestions ?? [],
    note: existing?.note ?? null,
    canvas: existing?.canvas ?? null,
  });
}

export function patchLocalResearchProject(
  userId: string,
  sessionId: string,
  patch: Partial<Omit<ResearchProject, "session">> & { session?: ResearchSession },
) {
  const existing = getLocalResearchProject(userId, sessionId);
  if (!existing && !patch.session) return null;
  return saveLocalResearchProject(userId, {
    session: patch.session ?? existing!.session,
    sources: patch.sources ?? existing?.sources ?? [],
    findings: patch.findings ?? existing?.findings ?? [],
    contradictions: patch.contradictions ?? existing?.contradictions ?? [],
    openQuestions: patch.openQuestions ?? existing?.openQuestions ?? [],
    note: patch.note === undefined ? existing?.note ?? null : patch.note,
    canvas: patch.canvas === undefined ? existing?.canvas ?? null : patch.canvas,
  });
}

export function subscribeToLocalResearch(userId: string, callback: () => void) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ userId: string }>).detail;
    if (detail.userId === userId) callback();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", callback);
  };
}
