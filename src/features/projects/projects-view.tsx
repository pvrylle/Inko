"use client";

import { ArrowRight, Check, FolderOpen, MessageSquareText, Plus, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentTopbar } from "@/components/layout/content-topbar";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import { useProjects } from "./project-provider";

export function ProjectsView({ startCreating = false }: { startCreating?: boolean }) {
  const router = useRouter();
  const projects = useProjects();
  const companion = useOptionalVoiceAgent();
  const [creating, setCreating] = useState(startCreating);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const openProject = (id: string) => {
    projects.activateProject(id);
    companion?.clearConversation();
    router.push("/");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !projects.owner) return;
    if (editingId) projects.renameProject(editingId, name, description);
    else if (!projects.createProject(name, description)) return;
    setCreating(false);
    setEditingId(null);
    setName("");
    setDescription("");
  };

  return (
    <div className="projects-workspace page-enter">
      <ContentTopbar />
      <div className="projects-content">
        <header className="projects-heading">
          <div><span className="workspace-eyebrow">Workspace</span><h1>Projects</h1><p>Keep related conversations and activities together.</p></div>
          <button className="workspace-command" onClick={() => { setEditingId(null); setName(""); setDescription(""); setCreating(true); }} type="button"><Plus size={18} /> New project</button>
        </header>

        {projects.projects.length === 0 ? (
          <div className="projects-empty"><FolderOpen size={28} /><h2>No projects yet</h2><p>Create a project for the work you want to keep together.</p></div>
        ) : (
          <div className="projects-list">
            {projects.projects.map((project) => {
              const conversations = companion?.sessions.filter((session) => !session.archived_at && projects.conversationProjects[session.id] === project.id) ?? [];
              const activities = projects.activities.filter((activity) => activity.projectId === project.id);
              return (
                <article className="project-item" data-active={project.id === projects.activeId} key={project.id}>
                  <div className="project-item-main">
                    <span className="project-item-mark" aria-hidden="true" />
                    <div><h2>{project.name}</h2>{project.description ? <p>{project.description}</p> : null}<small>{conversations.length} conversations · {activities.length} activities</small></div>
                  </div>
                  <div className="project-item-actions">
                    {project.id === projects.activeId ? <span className="project-active-label">Active</span> : null}
                    <button onClick={() => { setEditingId(project.id); setName(project.name); setDescription(project.description); setCreating(true); }} type="button">Edit</button>
                    <button onClick={() => openProject(project.id)} type="button">Open <ArrowRight size={16} /></button>
                    <button aria-label={`Delete ${project.name}`} onClick={() => setDeletingId(project.id)} title="Delete project" type="button"><Trash2 size={16} /></button>
                  </div>
                  {deletingId === project.id ? <div className="project-delete-confirm"><span>Delete this project? Its conversations will remain in History.</span><button onClick={() => setDeletingId(null)} type="button">Cancel</button><button onClick={() => { projects.deleteProject(project.id); setDeletingId(null); }} type="button">Delete</button></div> : null}
                  {conversations.length > 0 || activities.length > 0 ? (
                    <div className="project-item-recent">
                      {conversations.slice(0, 2).map((session) => <button key={session.id} onClick={() => { openProject(project.id); companion?.openConversation(session.id); }} type="button"><MessageSquareText size={15} />{session.title}</button>)}
                      {activities.slice(0, 2).map((activity) => <button key={activity.id} onClick={() => { projects.activateProject(project.id); router.push(activity.href); }} type="button">{activity.title}<ArrowRight size={14} /></button>)}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {creating ? (
        <div className="project-dialog-backdrop" onClick={() => setCreating(false)}>
          <div aria-labelledby="project-dialog-title" aria-modal="true" className="project-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="project-dialog-heading"><h2 id="project-dialog-title">{editingId ? "Edit project" : "New project"}</h2><button aria-label="Close" onClick={() => setCreating(false)} type="button"><X size={18} /></button></div>
            <form onSubmit={submit}>
              <label htmlFor="project-name">Name</label><input autoFocus id="project-name" maxLength={100} onChange={(event) => setName(event.target.value)} required value={name} />
              <label htmlFor="project-description">Description</label><textarea id="project-description" maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
              <button className="workspace-command" disabled={!projects.owner} type="submit"><Check size={17} /> {editingId ? "Save changes" : "Create project"}</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
