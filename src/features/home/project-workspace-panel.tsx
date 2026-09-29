"use client";

import { ArrowRight, Download, FileImage, FileText, MessageSquareText, Paperclip, Plus, Search, Trash2 } from "lucide-react";
import { type DragEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createResearchSession, getResearchNote, listContradictions, listFindings, listOpenQuestions, listSources } from "@/features/research/research-repository";
import type { OpenQuestion, ResearchContradiction, ResearchFinding, ResearchSource } from "@/features/research/research-schema";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import { getProjectFile } from "@/lib/data/project-files";
import type { InkoProject, ProjectContextValue } from "@/features/projects/project-provider";

export type ProjectTab = "chat" | "sources" | "debate" | "paper" | "research";

type Props = { project: InkoProject; projects: ProjectContextValue; tab: ProjectTab; onChat: () => void };

function SourcesPanel({ project, projects }: Pick<Props, "project" | "projects">) {
  const { userId } = useAuth();
  const companion = useOptionalVoiceAgent();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addFiles = async (files: FileList | File[]) => {
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) await projects.addSource(project.id, file);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A file could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void addFiles(event.dataTransfer.files);
  };

  const withFile = async (id: string, action: (file: File) => void | Promise<void>) => {
    if (!userId) return;
    try {
      const file = await getProjectFile(userId, id);
      if (!file) throw new Error("This file is not available on this device.");
      await action(file);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This file could not be opened.");
    }
  };

  return (
    <section className="project-panel project-sources-panel">
      <div className="project-panel-heading"><div><span className="workspace-eyebrow">Project library</span><h1>Sources</h1><p>PDFs and images saved for this project.</p></div><button className="workspace-command" disabled={busy} onClick={() => fileInput.current?.click()} type="button"><Plus size={17} /> Add files</button></div>
      <input accept=".pdf,image/png,image/jpeg,image/webp" aria-label="Add project sources" multiple onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }} ref={fileInput} type="file" />
      <div className="project-file-drop" onDragOver={(event) => event.preventDefault()} onDrop={drop}><Paperclip size={20} /><span>Drop PDFs or images here</span><small>Up to 8 MB each</small></div>
      {error ? <p className="project-panel-error" role="alert">{error}</p> : null}
      <div className="project-source-list">
        {(project.sources ?? []).length === 0 ? <p className="project-panel-empty">No sources yet.</p> : null}
        {(project.sources ?? []).map((source) => (
          <div className="project-source-row" key={source.id}>
            {source.type === "application/pdf" ? <FileText size={18} /> : <FileImage size={18} />}
            <span><strong>{source.name}</strong><small>{Math.max(1, Math.round(source.size / 1024))} KB</small></span>
            <button onClick={() => void withFile(source.id, (file) => { const url = URL.createObjectURL(file); window.open(url, "_blank", "noopener,noreferrer"); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); })} type="button">Open</button>
            <button onClick={() => void withFile(source.id, async (file) => { await companion?.sendAttachment(file, `Explain ${source.name} and its key points.`); })} type="button">Ask Inko</button>
            <button aria-label={`Remove ${source.name}`} onClick={() => void projects.removeSource(project.id, source.id)} title="Remove source" type="button"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaperPanel({ project, projects }: Pick<Props, "project" | "projects">) {
  const [content, setContent] = useState(project.paper ?? "");

  const download = () => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "paper"}.md`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="project-panel project-paper-panel">
      <div className="project-panel-heading"><div><span className="workspace-eyebrow">Working draft</span><h1>White paper</h1><p>{project.name}</p></div><div className="project-paper-actions"><span role="status">Saved on this device</span><button aria-label="Download draft" onClick={download} title="Download draft" type="button"><Download size={18} /></button></div></div>
      <div className="project-paper-page"><label className="sr-only" htmlFor="project-paper-editor">White paper draft</label><textarea id="project-paper-editor" onChange={(event) => { const next = event.target.value; setContent(next); projects.savePaper(project.id, next); }} placeholder="Title\n\nBegin your draft..." spellCheck value={content} /></div>
    </section>
  );
}

function DebatePanel({ project, projects }: Pick<Props, "project" | "projects">) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const debates = projects.activities.filter((activity) => activity.projectId === project.id && activity.type === "debate");
  const start = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = topic.trim();
    if (!text) return;
    const href = `/debate?topic=${encodeURIComponent(text.slice(0, 200))}&mode=debate`;
    projects.addActivity("debate", text, href);
    router.push(href);
  };
  return (
    <section className="project-panel">
      <div className="project-panel-heading"><div><span className="workspace-eyebrow">Challenge an idea</span><h1>Debate</h1><p>Work through the strongest arguments on both sides.</p></div></div>
      <form className="project-debate-form" onSubmit={start}><label htmlFor="project-debate-topic">Debate topic</label><div><input id="project-debate-topic" maxLength={200} onChange={(event) => setTopic(event.target.value)} placeholder="Should AI tutors replace lectures?" value={topic} /><button className="workspace-command" disabled={!topic.trim()} type="submit">Start <ArrowRight size={17} /></button></div></form>
      <h2 className="project-panel-subtitle">Previous debates</h2>
      {debates.length === 0 ? <p className="project-panel-empty">No debates in this project yet.</p> : debates.map((debate) => <button className="project-activity-row" key={debate.id} onClick={() => router.push(debate.href)} type="button"><MessageSquareText size={17} />{debate.title}<ArrowRight size={16} /></button>)}
    </section>
  );
}

function ResearchPanel({ project, projects }: Pick<Props, "project" | "projects">) {
  const router = useRouter();
  const { userId } = useAuth();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [contradictions, setContradictions] = useState<ResearchContradiction[]>([]);
  const [gaps, setGaps] = useState<OpenQuestion[]>([]);
  const [review, setReview] = useState("");

  useEffect(() => {
    if (!userId || !project.researchSessionId) return;
    let cancelled = false;
    const id = project.researchSessionId;
    void Promise.all([listSources(userId, id), listFindings(userId, id), listContradictions(userId, id), listOpenQuestions(userId, id), getResearchNote(userId, id)]).then(([nextSources, nextFindings, nextContradictions, nextGaps, note]) => {
      if (cancelled) return;
      setSources(nextSources); setFindings(nextFindings); setContradictions(nextContradictions); setGaps(nextGaps); setReview(note?.content_markdown ?? "");
    }).catch(() => { if (!cancelled) setError("Research could not be loaded."); });
    return () => { cancelled = true; };
  }, [project.researchSessionId, userId]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || question.trim().length < 10) return;
    setBusy(true); setError(null);
    try {
      const session = await createResearchSession(userId, question.trim());
      projects.linkResearch(project.id, session.id);
      projects.addActivity("research", question.trim(), `/research?session=${session.id}`);
    } catch {
      setError("Research could not be started. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <section className="project-panel project-research-panel">
      <div className="project-panel-heading"><div><span className="workspace-eyebrow">Evidence desk</span><h1>Research</h1><p>Review literature, synthesis, gaps, opposing arguments, and citations.</p></div>{project.researchSessionId ? <button className="workspace-command" onClick={() => router.push(`/research?session=${project.researchSessionId}`)} type="button">Open research desk <ArrowRight size={17} /></button> : null}</div>
      {!project.researchSessionId ? <form className="project-research-form" onSubmit={(event) => void create(event)}><label htmlFor="project-research-question">Research question</label><textarea id="project-research-question" maxLength={500} minLength={10} onChange={(event) => setQuestion(event.target.value)} placeholder="What question should we investigate?" rows={3} value={question} /><button className="workspace-command" disabled={busy || question.trim().length < 10} type="submit"><Search size={17} /> Start research</button></form> : null}
      {error ? <p className="project-panel-error" role="alert">{error}</p> : null}
      {project.researchSessionId ? <div className="project-research-sections">
        <section><h2>RRL</h2><p>{review || "The literature review will appear after sources are analyzed in the research desk."}</p></section>
        <section><h2>Synthesis</h2>{findings.length ? <ul>{findings.map((finding) => <li key={finding.id}>{finding.statement}</li>)}</ul> : <p>No findings yet.</p>}</section>
        <section><h2>Gaps</h2>{gaps.length ? <ul>{gaps.map((gap) => <li key={gap.id}>{gap.text}</li>)}</ul> : <p>No gaps recorded yet.</p>}</section>
        <section><h2>Opposing arguments</h2>{contradictions.length ? <ul>{contradictions.map((item) => <li key={item.id}>{item.explanation}</li>)}</ul> : <p>No opposing findings recorded yet.</p>}</section>
        <section><h2>Citations</h2>{sources.length ? <ol>{sources.map((source) => <li key={source.id}>{source.url ? <a href={source.url} rel="noopener noreferrer" target="_blank">{source.title}</a> : source.title}</li>)}</ol> : <p>No cited sources yet.</p>}</section>
      </div> : null}
    </section>
  );
}

export function ProjectWorkspacePanel({ project, projects, tab, onChat }: Props) {
  return <div className="project-workspace-content">
    <button className="project-back-chat" onClick={onChat} type="button">Chat with Inko <ArrowRight size={15} /></button>
    {tab === "sources" ? <SourcesPanel project={project} projects={projects} /> : null}
    {tab === "debate" ? <DebatePanel project={project} projects={projects} /> : null}
    {tab === "paper" ? <PaperPanel project={project} projects={projects} /> : null}
    {tab === "research" ? <ResearchPanel project={project} projects={projects} /> : null}
  </div>;
}
