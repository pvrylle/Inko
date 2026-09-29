"use client";

import { ArrowUp, FileImage, FileText, Mic, Paperclip, Square, X } from "lucide-react";
import { type DragEvent, type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ContentTopbar } from "@/components/layout/content-topbar";
import { useOptionalProjects } from "@/features/projects/project-provider";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import { ChatSuggestions, SessionDirectory, sessionLinksFrom } from "./chat-suggestions";
import { StudyAnswerText } from "./study-answer-card";
import { ProjectWorkspacePanel, type ProjectTab } from "./project-workspace-panel";

const projectTabs: { id: ProjectTab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "sources", label: "Sources" },
  { id: "debate", label: "Debate" },
  { id: "paper", label: "White paper" },
  { id: "research", label: "Research" },
];

export function HomeOrbit() {
  const controller = useOptionalVoiceAgent();
  const projects = useOptionalProjects();
  const activeProject = projects?.projects.find((project) => project.id === projects.activeId);
  const [tabState, setTabState] = useState<{ projectId: string | null; tab: ProjectTab }>({ projectId: null, tab: "chat" });
  const activeTab = tabState.projectId === (activeProject?.id ?? null) ? tabState.tab : "chat";
  const setActiveTab = (tab: ProjectTab) => setTabState({ projectId: activeProject?.id ?? null, tab });
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("chat");
    if (requested && controller?.sessions.some((session) => session.id === requested)) controller.openConversation(requested);
  }, [controller]);

  const threadScrollKey = `${controller?.messages.length ?? 0}:${controller?.replyPending ? 1 : 0}:${controller?.draftReply?.length ?? 0}`;
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const distance = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    if (distance < 220) thread.scrollTop = thread.scrollHeight;
  }, [threadScrollKey]);

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setUploadError("Choose a PDF, PNG, JPG, or WebP file under 8 MB.");
      return;
    }
    setUploadError(null);
    setAttachment(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    chooseFile(event.dataTransfer.files[0]);
    setActiveTab("chat");
  };

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controller || controller.replyPending || sending || (!draft.trim() && !attachment)) return;
    const text = draft.trim();
    const file = attachment;
    setSending(true);
    try {
      if (file) {
        if (activeProject && projects) await projects.addSource(activeProject.id, file);
        await controller.sendAttachment(file, text);
      } else {
        await controller.sendText(text);
      }
      setDraft("");
      setAttachment(null);
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "The file could not be saved.");
    } finally {
      setSending(false);
    }
  };

  const onDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const voiceActive = controller?.connection === "connected" || controller?.connection === "connecting" || controller?.connection === "ending";
  const messages = controller?.messages ?? [];
  const activeChat = controller?.sessions.find((session) => session.id === controller.activeSessionId);

  return (
    <div className="assistant-home page-enter" onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDrop={onDrop}>
      <ContentTopbar><div className="conversation-topbar-title"><span>{activeProject?.name || "Chat"}</span><strong title={activeChat?.title || "New chat"}>{activeChat?.title || "New chat"}</strong></div></ContentTopbar>
      {activeProject && projects ? (
        <div className="project-workspace-header">
          <div><span className="workspace-eyebrow">Project</span><strong>{activeProject.name}</strong></div>
          <nav aria-label="Project workspace" className="project-workspace-tabs">
            {projectTabs.map((tab) => <button aria-current={activeTab === tab.id ? "page" : undefined} key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">{tab.label}</button>)}
          </nav>
        </div>
      ) : null}

      {activeTab !== "chat" && activeProject && projects ? (
        <ProjectWorkspacePanel key={`${activeProject.id}:${activeTab}`} project={activeProject} projects={projects} tab={activeTab} onChat={() => setActiveTab("chat")} />
      ) : (
        <div className="home-conversation">
          <div className="home-conversation-thread" ref={threadRef}>
            {messages.length === 0 ? (
              <div className="home-conversation-empty">
                <span className="workspace-eyebrow">{activeProject?.name || "New chat"}</span>
                <h1>What should we work on?</h1>
                <p>Ask a question, share a file, or talk to Inko.</p>
              </div>
            ) : (
              <div className="home-conversation-messages">
                {messages.map((message) => (
                  <article className="home-conversation-message" data-role={message.role} key={message.id}>
                    <span>{message.role === "inko" ? "Inko" : "You"}</span>
                    {message.attachment ? <div className="home-message-file">{message.attachment.type === "application/pdf" ? <FileText size={16} /> : <FileImage size={16} />}{message.attachment.name}</div> : null}
                    {message.link ? <SessionDirectory links={[message.link]} /> : message.role === "inko" ? <StudyAnswerText sources={message.sources ?? []} text={message.text} /> : <p>{message.text}</p>}
                    {message.sources?.length ? <details><summary>Sources ({message.sources.length})</summary><ul>{message.sources.map((source) => <li key={source.url}><a href={source.url} rel="noopener noreferrer" target="_blank">{source.title}</a></li>)}</ul></details> : null}
                  </article>
                ))}
                {controller?.draftReply ? (
                  <article className="home-conversation-message" data-role="inko">
                    <span>Inko</span>
                    <StudyAnswerText sources={[]} text={controller.draftReply} />
                  </article>
                ) : controller?.replyPending ? <p aria-live="polite" className="home-conversation-pending">Inko is thinking...</p> : null}
              </div>
            )}
          </div>
          <div className="home-conversation-bottom">
            {controller?.partialTranscript ? <p aria-live="polite" className="home-live-transcript"><span>{controller.replyPending ? "Inko" : "Listening"}</span> {controller.partialTranscript}</p> : null}
            {controller?.error ? <p className="home-conversation-error" role="status">{controller.error}</p> : null}
            {uploadError ? <p className="home-conversation-error" role="alert">{uploadError}</p> : null}
            <SessionDirectory links={sessionLinksFrom(messages)} />
            <ChatSuggestions
              messages={messages}
              sessionTitle={activeChat?.title}
              researchSessionId={activeChat?.research_session_id ?? null}
              onResearchSessionCreated={(id) => controller?.linkResearchSession(id)}
              onPinLink={(link) => controller?.pinSessionLink(link)}
            />
            <form className="home-conversation-composer" onSubmit={(event) => void send(event)}>
              {attachment ? <div className="home-attachment"><Paperclip size={16} /><span>{attachment.name}</span><button aria-label="Remove attachment" onClick={() => setAttachment(null)} type="button"><X size={16} /></button></div> : null}
              <label className="sr-only" htmlFor="home-chat-input">Message Inko</label>
              <textarea id="home-chat-input" maxLength={4000} onChange={(event) => setDraft(event.target.value)} onKeyDown={onDraftKeyDown} placeholder="Message Inko" rows={2} value={draft} />
              <div className="home-composer-tools">
                <input accept=".pdf,image/png,image/jpeg,image/webp" aria-label="Attach PDF or image" onChange={(event) => chooseFile(event.target.files?.[0])} ref={fileInputRef} type="file" />
                <button aria-label="Attach PDF or image" onClick={() => fileInputRef.current?.click()} title="Attach PDF or image" type="button"><Paperclip size={19} /></button>
                <span className="home-composer-spacer" />
                <button aria-label={voiceActive ? "End voice session" : "Start talking to Inko"} aria-pressed={voiceActive} onClick={() => { if (voiceActive) controller?.end(); else void controller?.start(); }} title={voiceActive ? "End voice session" : "Start talking to Inko"} type="button">{voiceActive ? <Square size={18} /> : <Mic size={19} />}</button>
                <button aria-label="Send message" className="home-composer-send" disabled={(!draft.trim() && !attachment) || controller?.replyPending || sending} title="Send message" type="submit"><ArrowUp size={20} /></button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
