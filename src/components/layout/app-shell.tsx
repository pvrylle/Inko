"use client";

import { Archive, Check, ChevronDown, ChevronRight, FileText, FolderOpen, Layers3, Menu, MessageCircle, MessageSquarePlus, MessageSquareText, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Search, Settings, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { InkoLogo } from "@/components/ui/inko-logo";
import { HomeChat } from "@/features/home/home-chat";
import { useOptionalProjects } from "@/features/projects/project-provider";
import { useOptionalVoiceAgent, type VoiceAgentController } from "@/features/voice/voice-agent-provider";
import { GuestBanner } from "@/features/guest/guest-banner";
import { AppGuide, hasSeenAppGuide, markAppGuideSeen } from "@/features/onboarding/app-guide";

const links = [
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/research", label: "Research", icon: Search },
  { href: "/debate", label: "Debate", icon: MessageSquareText },
  { href: "/sources", label: "Sources", icon: FileText },
  { href: "/flashcards", label: "Flashcards", icon: Layers3 },
] as const;

type ChatSession = VoiceAgentController["sessions"][number];

function SidebarChatRow({
  session,
  active,
  controller,
  projects,
  editingChatId,
  deletingChatId,
  chatMenuId,
  draftTitle,
  setDraftTitle,
  setEditingChatId,
  setDeletingChatId,
  setChatMenuId,
  onOpen,
}: {
  session: ChatSession;
  active: boolean;
  controller: VoiceAgentController;
  projects: ReturnType<typeof useOptionalProjects>;
  editingChatId: string | null;
  deletingChatId: string | null;
  chatMenuId: string | null;
  draftTitle: string;
  setDraftTitle: (value: string) => void;
  setEditingChatId: (id: string | null) => void;
  setDeletingChatId: (id: string | null) => void;
  setChatMenuId: (id: string | null) => void;
  onOpen: () => void;
}) {
  const label = session.title || "New chat";
  if (editingChatId === session.id) {
    return (
      <form className="sidebar-chat-edit" onSubmit={(event) => { event.preventDefault(); if (draftTitle.trim()) controller.renameConversation(session.id, draftTitle); setEditingChatId(null); }}>
        <input aria-label={`Rename ${label}`} autoFocus maxLength={160} onChange={(event) => setDraftTitle(event.target.value)} value={draftTitle} />
        <button aria-label="Save chat name" type="submit"><Check size={15} /></button>
        <button aria-label="Cancel rename" onClick={() => setEditingChatId(null)} type="button"><X size={15} /></button>
      </form>
    );
  }
  if (deletingChatId === session.id) {
    return (
      <div className="sidebar-chat-confirm">
        <span>Delete this chat?</span>
        <button onClick={() => setDeletingChatId(null)} type="button">Cancel</button>
        <button onClick={() => { controller.removeConversation(session.id); setDeletingChatId(null); }} type="button">Delete</button>
      </div>
    );
  }
  return (
    <div className="sidebar-chat-row">
      <button aria-current={active ? "true" : undefined} className="sidebar-list-item sidebar-chat-open" onClick={onOpen} title={label} type="button"><span>{label}</span></button>
      <button aria-expanded={chatMenuId === session.id} aria-label={`Options for ${label}`} className="sidebar-chat-options" onClick={() => setChatMenuId(chatMenuId === session.id ? null : session.id)} type="button"><MoreHorizontal size={17} /></button>
      {chatMenuId === session.id ? (
        <div className="sidebar-chat-menu">
          <button onClick={() => { setDraftTitle(label); setEditingChatId(session.id); setChatMenuId(null); }} type="button">Rename</button>
          {projects?.projects.length ? (
            <label>Move to project
              <select aria-label={`Project for ${label}`} onChange={(event) => { projects.assignConversation(session.id, event.target.value || null); setChatMenuId(null); }} value={projects.conversationProjects[session.id] ?? ""}>
                <option value="">All chats</option>
                {projects.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
          ) : null}
          <button onClick={() => { controller.archiveConversation(session.id); setChatMenuId(null); }} type="button"><Archive size={14} /> Archive</button>
          <button onClick={() => { setDeletingChatId(session.id); setChatMenuId(null); }} type="button"><Trash2 size={14} /> Delete</button>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const controller = useOptionalVoiceAgent();
  const projects = useOptionalProjects();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatMenuId, setChatMenuId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [allChatsOpen, setAllChatsOpen] = useState(true);
  const [guideStep, setGuideStep] = useState<0 | 1 | 2 | null>(null);

  useEffect(() => {
    if (!hasSeenAppGuide()) setGuideStep(0);
  }, []);

  if (pathname === "/welcome") return <>{children}</>;

  const showGuide = guideStep !== null && Boolean(controller);

  const closeSidebar = () => setSidebarOpen(false);
  const liveSessions = controller?.sessions.filter((session) => !session.archived_at) ?? [];
  const archived = controller?.sessions.filter((session) => session.archived_at) ?? [];
  const unassigned = liveSessions.filter((session) => !projects?.conversationProjects[session.id]);
  const chatsFor = (projectId: string) => liveSessions.filter((session) => projects?.conversationProjects[session.id] === projectId);
  const allChatsActive = pathname === "/" && !projects?.activeId;

  const newChat = () => {
    projects?.activateProject(null);
    controller?.clearConversation();
    router.push("/");
    setAllChatsOpen(true);
    setAssistantOpen(false);
    setSidebarOpen(false);
  };

  const openFolder = (projectId: string | null) => {
    projects?.activateProject(projectId);
    if (projectId) setOpenProjectIds((current) => ({ ...current, [projectId]: true }));
    else setAllChatsOpen(true);
    router.push("/");
  };

  const openChat = (session: ChatSession) => {
    projects?.activateProject(projects.conversationProjects[session.id] ?? null);
    controller?.openConversation(session.id);
    router.push("/");
    closeSidebar();
    setChatMenuId(null);
  };

  const finishGuide = () => {
    markAppGuideSeen();
    setGuideStep(null);
  };

  const openGuideChat = () => {
    closeSidebar();
    setAssistantOpen(true);
    setGuideStep(1);
  };

  const chatRow = (session: ChatSession) => controller ? (
    <SidebarChatRow
      key={session.id}
      session={session}
      active={session.id === controller.activeSessionId}
      controller={controller}
      projects={projects}
      editingChatId={editingChatId}
      deletingChatId={deletingChatId}
      chatMenuId={chatMenuId}
      draftTitle={draftTitle}
      setDraftTitle={setDraftTitle}
      setEditingChatId={setEditingChatId}
      setDeletingChatId={setDeletingChatId}
      setChatMenuId={setChatMenuId}
      onOpen={() => openChat(session)}
    />
  ) : null;

  return (
    <div className="app-frame assistant-shell" data-assistant-open={assistantOpen} data-guide={showGuide ? (guideStep === 0 ? "button" : guideStep === 1 ? "panel" : "composer") : undefined} data-sidebar-collapsed={sidebarCollapsed}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {sidebarOpen && <button aria-label="Close navigation" className="sidebar-scrim" onClick={closeSidebar} type="button" />}
      <aside className="desktop-sidebar" data-open={sidebarOpen} id="workspace-navigation" aria-label="Primary navigation">
        <div className="sidebar-brand"><InkoLogo /><button aria-controls="workspace-navigation" aria-expanded={sidebarOpen} aria-label="Expand navigation" className="sidebar-compact-expand" onClick={() => { setAssistantOpen(false); setSidebarOpen(true); }} title="Expand navigation" type="button"><PanelLeftOpen size={18} /></button><button aria-label="Hide navigation" className="sidebar-collapse" onClick={() => { setSidebarCollapsed(true); closeSidebar(); }} title="Hide navigation" type="button"><PanelLeftClose size={18} /></button><button aria-label="Close navigation" className="sidebar-drawer-close" onClick={closeSidebar} type="button"><X size={18} /></button></div>
        <button aria-current={pathname === "/" && !controller?.activeSessionId ? "page" : undefined} aria-label="New chat" className="sidebar-new-chat" onClick={newChat} title="New chat" type="button"><MessageSquarePlus size={18} /><span>New chat</span></button>
        <nav className="sidebar-primary-nav" aria-label="Workspace">
          {links.map(({ href, icon: Icon, label }) => <Link aria-current={pathname === href ? "page" : undefined} aria-label={label} href={href} key={href} onClick={closeSidebar} title={label}><Icon size={17} /><span>{label}</span></Link>)}
        </nav>
        <div className="sidebar-scroll">
          <section className="sidebar-list-section" aria-label="Projects">
            <div className="sidebar-list-heading"><span>Projects</span><Link aria-label="Create project" href="/projects?new=1" onClick={closeSidebar} title="Create project"><Plus size={16} /></Link></div>
            {projects?.projects.map((project) => {
              const open = openProjectIds[project.id] ?? project.id === projects.activeId;
              const nested = chatsFor(project.id);
              return (
                <div className="sidebar-folder" key={project.id}>
                  <div className="sidebar-folder-row">
                    <button aria-expanded={open} aria-label={open ? `Collapse ${project.name}` : `Expand ${project.name}`} className="sidebar-folder-toggle" onClick={() => setOpenProjectIds((current) => ({ ...current, [project.id]: !open }))} type="button">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                    <button aria-current={pathname === "/" && project.id === projects.activeId ? "true" : undefined} className="sidebar-list-item" onClick={() => openFolder(project.id)} type="button"><FolderOpen size={15} /><span>{project.name}</span></button>
                  </div>
                  {open ? <div className="sidebar-folder-items">{nested.length ? nested.map(chatRow) : <p className="sidebar-list-empty">No chats in this project</p>}</div> : null}
                </div>
              );
            })}
            {!projects?.projects.length ? <p className="sidebar-list-empty">No projects yet</p> : null}
          </section>
          <section className="sidebar-list-section" aria-label="All chats">
            <div className="sidebar-folder">
              <div className="sidebar-folder-row">
                <button aria-expanded={allChatsOpen} aria-label={allChatsOpen ? "Collapse all chats" : "Expand all chats"} className="sidebar-folder-toggle" onClick={() => setAllChatsOpen((open) => !open)} type="button">{allChatsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                <button aria-current={allChatsActive ? "true" : undefined} className="sidebar-list-item" onClick={() => openFolder(null)} type="button"><MessageCircle size={15} /><span>All chats</span></button>
              </div>
              {allChatsOpen ? <div className="sidebar-folder-items">{unassigned.length ? unassigned.map(chatRow) : <p className="sidebar-list-empty">New chats will land here</p>}</div> : null}
            </div>
          </section>
          {archived.length ? <section className="sidebar-list-section" aria-label="Archived chats"><div className="sidebar-list-heading"><span>Archived</span></div>
            {archived.map((session) => <div className="sidebar-chat-row" key={session.id}><span className="sidebar-chat-archived" title={session.title}>{session.title || "New chat"}</span><button aria-label={`Restore ${session.title || "New chat"}`} className="sidebar-chat-options" onClick={() => controller?.restoreConversation(session.id)} title="Restore chat" type="button"><RotateCcw size={15} /></button></div>)}
          </section> : null}
        </div>
        <Link aria-current={pathname === "/settings" ? "page" : undefined} aria-label="Settings" className="sidebar-settings" href="/settings" onClick={closeSidebar} title="Settings"><Settings size={17} /><span>Settings</span></Link>
      </aside>

      <button aria-controls="workspace-navigation" aria-expanded={!sidebarCollapsed} aria-label="Show navigation" className="sidebar-reopen" onClick={() => setSidebarCollapsed(false)} title="Show navigation" type="button"><PanelLeftOpen size={20} /></button>
      <header className="mobile-header"><button aria-controls="workspace-navigation" aria-expanded={sidebarOpen} aria-label="Open navigation" className="mobile-menu-toggle" onClick={() => { setAssistantOpen(false); setSidebarOpen(true); }} type="button"><Menu size={21} /></button><InkoLogo compact /><button aria-label="New chat" onClick={newChat} title="New chat" type="button"><MessageSquarePlus size={20} /></button></header>
      <GuestBanner />
      <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>

      {controller ? <>
        {assistantOpen ? <button aria-label="Close assistant" className="assistant-rail-scrim" onClick={() => setAssistantOpen(false)} type="button" /> : null}
        <aside className="assistant-rail" data-open={assistantOpen} id="inko-assistant"><HomeChat controller={controller} home={pathname === "/"} onClose={() => setAssistantOpen(false)} /></aside>
        <button aria-controls="inko-assistant" aria-expanded={assistantOpen} aria-label={assistantOpen ? "Hide Inko assistant" : "Show Inko assistant"} className="assistant-rail-toggle" onClick={() => { if (guideStep === 0) openGuideChat(); else { closeSidebar(); setAssistantOpen((open) => !open); } }} type="button"><MessageCircle size={21} /><span>Inko</span></button>
      </> : null}
      {showGuide && guideStep !== null ? (
        <AppGuide
          step={pathname === "/" || guideStep < 2 ? guideStep : 1}
          onOpenChat={openGuideChat}
          onNext={() => { if (pathname === "/") setGuideStep(2); else finishGuide(); }}
          onDone={finishGuide}
        />
      ) : null}

      <nav className="mobile-nav" aria-label="Primary navigation">
        <button aria-label="New chat" onClick={newChat} type="button"><MessageSquarePlus size={20} /><span>Chat</span></button>
        <Link aria-current={pathname === "/projects" ? "page" : undefined} href="/projects"><FolderOpen size={20} /><span>Projects</span></Link>
        <Link aria-current={pathname === "/research" ? "page" : undefined} href="/research"><Search size={20} /><span>Research</span></Link>
        <Link aria-current={pathname === "/debate" ? "page" : undefined} href="/debate"><MessageSquareText size={20} /><span>Debate</span></Link>
      </nav>
    </div>
  );
}
