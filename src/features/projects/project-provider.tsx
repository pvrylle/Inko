"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { deleteProjectFile, saveProjectFile } from "@/lib/data/project-files";

export type ProjectSource = { id: string; name: string; type: string; size: number; createdAt: string };

export type InkoProject = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  paper?: string;
  sources?: ProjectSource[];
  researchSessionId?: string | null;
};

export type ProjectActivity = {
  id: string;
  projectId: string;
  type: "debate" | "timer" | "research";
  title: string;
  href: string;
  createdAt: string;
};

type Workspace = {
  owner: string | null;
  projects: InkoProject[];
  activeId: string | null;
  conversationProjects: Record<string, string>;
  activities: ProjectActivity[];
};

export type ProjectContextValue = Workspace & {
  createProject: (name: string, description?: string) => string | null;
  renameProject: (id: string, name: string, description: string) => void;
  deleteProject: (id: string) => void;
  activateProject: (id: string | null) => void;
  assignConversation: (sessionId: string, projectId?: string | null) => void;
  addActivity: (type: ProjectActivity["type"], title: string, href: string) => void;
  savePaper: (projectId: string, content: string) => void;
  addSource: (projectId: string, file: File) => Promise<ProjectSource>;
  removeSource: (projectId: string, sourceId: string) => Promise<void>;
  linkResearch: (projectId: string, sessionId: string) => void;
};

const emptyWorkspace: Workspace = { owner: null, projects: [], activeId: null, conversationProjects: {}, activities: [] };
const ProjectContext = createContext<ProjectContextValue | null>(null);

function keyFor(owner: string) {
  return `inko.projects.${owner}`;
}

function readWorkspace(owner: string): Workspace {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(keyFor(owner)) ?? "null");
    if (!value || typeof value !== "object") return { ...emptyWorkspace, owner };
    const saved = value as Partial<Workspace>;
    const projects = Array.isArray(saved.projects) ? saved.projects.filter((project): project is InkoProject =>
      typeof project?.id === "string" && typeof project.name === "string" && typeof project.description === "string" && typeof project.createdAt === "string",
    ) : [];
    const activeId = projects.some((project) => project.id === saved.activeId) ? saved.activeId ?? null : null;
    return {
      owner,
      projects,
      activeId,
      conversationProjects: saved.conversationProjects && typeof saved.conversationProjects === "object" ? saved.conversationProjects : {},
      activities: Array.isArray(saved.activities) ? saved.activities : [],
    };
  } catch {
    return { ...emptyWorkspace, owner };
  }
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { userId, isReady } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const storedWorkspace = useMemo(() => isReady && userId ? readWorkspace(userId) : emptyWorkspace, [isReady, userId]);
  const currentWorkspace = isReady && userId && workspace.owner === userId ? workspace : storedWorkspace;

  const update = useCallback((change: (current: Workspace) => Workspace) => {
    if (!userId) return;
    setWorkspace((current) => {
      const next = change(current.owner === userId ? current : readWorkspace(userId));
      try { window.localStorage.setItem(keyFor(userId), JSON.stringify(next)); } catch { /* Storage can be unavailable. */ }
      return next;
    });
  }, [userId]);

  const createProject = useCallback((name: string, description = "") => {
    const trimmed = name.trim().slice(0, 100);
    if (!trimmed || !userId) return null;
    const id = crypto.randomUUID();
    const project: InkoProject = { id, name: trimmed, description: description.trim().slice(0, 500), createdAt: new Date().toISOString() };
    update((current) => ({ ...current, projects: [project, ...current.projects], activeId: id }));
    return id;
  }, [update, userId]);

  const renameProject = useCallback((id: string, name: string, description: string) => {
    if (!name.trim()) return;
    update((current) => ({ ...current, projects: current.projects.map((project) => project.id === id ? { ...project, name: name.trim().slice(0, 100), description: description.trim().slice(0, 500) } : project) }));
  }, [update]);

  const deleteProject = useCallback((id: string) => {
    const sourceIds = currentWorkspace.projects.find((project) => project.id === id)?.sources?.map((source) => source.id) ?? [];
    if (userId) void Promise.all(sourceIds.map((sourceId) => deleteProjectFile(userId, sourceId))).catch(() => undefined);
    update((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
      activeId: current.activeId === id ? null : current.activeId,
      conversationProjects: Object.fromEntries(Object.entries(current.conversationProjects).filter(([, projectId]) => projectId !== id)),
      activities: current.activities.filter((activity) => activity.projectId !== id),
    }));
  }, [currentWorkspace.projects, update, userId]);

  const activateProject = useCallback((id: string | null) => {
    update((current) => ({ ...current, activeId: id === null || current.projects.some((project) => project.id === id) ? id : current.activeId }));
  }, [update]);

  const assignConversation = useCallback((sessionId: string, projectId?: string | null) => {
    update((current) => {
      const target = projectId === undefined ? current.activeId : projectId;
      const links = { ...current.conversationProjects };
      if (target && current.projects.some((project) => project.id === target)) links[sessionId] = target;
      else delete links[sessionId];
      return { ...current, conversationProjects: links };
    });
  }, [update]);

  const addActivity = useCallback((type: ProjectActivity["type"], title: string, href: string) => {
    update((current) => current.activeId ? {
      ...current,
      activities: [{ id: crypto.randomUUID(), projectId: current.activeId, type, title, href, createdAt: new Date().toISOString() }, ...current.activities].slice(0, 200),
    } : current);
  }, [update]);

  const savePaper = useCallback((projectId: string, content: string) => {
    update((current) => ({ ...current, projects: current.projects.map((project) => project.id === projectId ? { ...project, paper: content.slice(0, 100_000) } : project) }));
  }, [update]);

  const addSource = useCallback(async (projectId: string, file: File) => {
    if (!userId) throw new Error("Sign in or continue as a guest first.");
    if (!currentWorkspace.projects.some((project) => project.id === projectId)) throw new Error("Project not found.");
    if (!(["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type))) throw new Error("Choose a PDF, PNG, JPG, or WebP file.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Files must be 8 MB or smaller.");
    const source: ProjectSource = { id: crypto.randomUUID(), name: file.name.slice(0, 160), type: file.type, size: file.size, createdAt: new Date().toISOString() };
    await saveProjectFile(userId, source.id, file);
    update((current) => ({ ...current, projects: current.projects.map((project) => project.id === projectId ? { ...project, sources: [...(project.sources ?? []), source] } : project) }));
    return source;
  }, [currentWorkspace.projects, update, userId]);

  const removeSource = useCallback(async (projectId: string, sourceId: string) => {
    if (!userId) return;
    await deleteProjectFile(userId, sourceId);
    update((current) => ({ ...current, projects: current.projects.map((project) => project.id === projectId ? { ...project, sources: (project.sources ?? []).filter((source) => source.id !== sourceId) } : project) }));
  }, [update, userId]);

  const linkResearch = useCallback((projectId: string, sessionId: string) => {
    update((current) => ({ ...current, projects: current.projects.map((project) => project.id === projectId ? { ...project, researchSessionId: sessionId } : project) }));
  }, [update]);

  const value = useMemo(() => ({ ...currentWorkspace, createProject, renameProject, deleteProject, activateProject, assignConversation, addActivity, savePaper, addSource, removeSource, linkResearch }), [currentWorkspace, createProject, renameProject, deleteProject, activateProject, assignConversation, addActivity, savePaper, addSource, removeSource, linkResearch]);
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useOptionalProjects() {
  return useContext(ProjectContext);
}

export function useProjects() {
  const projects = useOptionalProjects();
  if (!projects) throw new Error("useProjects must be used within ProjectProvider");
  return projects;
}
