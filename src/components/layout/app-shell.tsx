"use client";

import { Archive, Check, Clock3, FileText, FolderOpen, Library, Menu, MessageCircle, MessageSquarePlus, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Search, Settings, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { InkoLogo } from "@/components/ui/inko-logo";
import { HomeChat } from "@/features/home/home-chat";
import { useOptionalProjects } from "@/features/projects/project-provider";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import { GuestBanner } from "@/features/guest/guest-banner";

const links = [
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/research", label: "Research", icon: Search },
  { href: "/sources", label: "Sources", icon: FileText },
  { href: "/library", label: "Library", icon: Library },
  { href: "/history", label: "History", icon: Clock3 },
] as const;

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

  if (pathname === "/welcome") return <>{children}</>;

  const newChat = () => {
    controller?.clearConversation();
    router.push("/");
    setAssistantOpen(false);
    setSidebarOpen(false);
  };

  const openProject = (id: string) => {
    projects?.activateProject(id);
    const latest = controller?.sessions.find((session) => !session.archived_at && projects?.conversationProjects[session.id] === id);
    if (latest) controller?.openConversation(latest.id);
    else controller?.clearConversation();
    router.push("/");
    setAssistantOpen(false);
  };

  const openAllChats = () => {
    projects?.activateProject(null);
    const latest = controller?.sessions.find((session) => !session.archived_at);
    if (latest) controller?.openConversation(latest.id);
    else controller?.clearConversation();
    router.push("/");
    setAssistantOpen(false);
  };

  const recent = controller?.sessions.filter((session) => !session.archived_at && (!projects?.activeId || projects.conversationProjects[session.id] === projects.activeId)) ?? [];
  const archived = controller?.sessions.filter((session) => session.archived_at) ?? [];
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-frame assistant-shell" data-assistant-open={assistantOpen} data-sidebar-collapsed={sidebarCollapsed}>
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
            <button aria-current={pathname === "/" && !projects?.activeId && !!controller?.activeSessionId ? "true" : undefined} className="sidebar-list-item" onClick={() => { openAllChats(); closeSidebar(); }} type="button"><MessageCircle size={15} /><span>All chats</span></button>
            {projects?.projects.map((project) => <button aria-current={pathname === "/" && project.id === projects.activeId ? "true" : undefined} className="sidebar-list-item" key={project.id} onClick={() => { openProject(project.id); closeSidebar(); }} type="button"><FolderOpen size={15} /><span>{project.name}</span></button>)}
            {!projects?.projects.length ? <p className="sidebar-list-empty">No projects yet</p> : null}
          </section>
          <section className="sidebar-list-section" aria-label="Recent chats">
            <div className="sidebar-list-heading"><span>Recents</span></div>
            {recent.map((session) => <div className="sidebar-chat-row" key={session.id}>
              {editingChatId === session.id ? <form className="sidebar-chat-edit" onSubmit={(event) => { event.preventDefault(); if (draftTitle.trim()) controller?.renameConversation(session.id, draftTitle); setEditingChatId(null); }}>
                <input aria-label={`Rename ${session.title || "New chat"}`} autoFocus maxLength={160} onChange={(event) => setDraftTitle(event.target.value)} value={draftTitle} />
                <button aria-label="Save chat name" type="submit"><Check size={15} /></button><button aria-label="Cancel rename" onClick={() => setEditingChatId(null)} type="button"><X size={15} /></button>
              </form> : deletingChatId === session.id ? <div className="sidebar-chat-confirm"><span>Delete this chat?</span><button onClick={() => setDeletingChatId(null)} type="button">Cancel</button><button onClick={() => { controller?.removeConversation(session.id); setDeletingChatId(null); }} type="button">Delete</button></div> : <>
                <button aria-current={session.id === controller?.activeSessionId ? "true" : undefined} className="sidebar-list-item sidebar-chat-open" onClick={() => { projects?.activateProject(projects.conversationProjects[session.id] ?? null); controller?.openConversation(session.id); router.push("/"); closeSidebar(); setChatMenuId(null); }} title={session.title || "New chat"} type="button"><span>{session.title || "New chat"}</span></button>
                <button aria-expanded={chatMenuId === session.id} aria-label={`Options for ${session.title || "New chat"}`} className="sidebar-chat-options" onClick={() => setChatMenuId((current) => current === session.id ? null : session.id)} type="button"><MoreHorizontal size={17} /></button>
                {chatMenuId === session.id ? <div className="sidebar-chat-menu">
                  <button onClick={() => { setDraftTitle(session.title || "New chat"); setEditingChatId(session.id); setChatMenuId(null); }} type="button">Rename</button>
                  {projects?.projects.length ? <label>Move to project<select aria-label={`Project for ${session.title || "New chat"}`} onChange={(event) => { projects.assignConversation(session.id, event.target.value || null); setChatMenuId(null); }} value={projects.conversationProjects[session.id] ?? ""}><option value="">No project</option>{projects.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label> : null}
                  <button onClick={() => { controller?.archiveConversation(session.id); setChatMenuId(null); }} type="button"><Archive size={14} /> Archive</button>
                  <button onClick={() => { setDeletingChatId(session.id); setChatMenuId(null); }} type="button"><Trash2 size={14} /> Delete</button>
                </div> : null}
              </>}
            </div>)}
            {!recent.length ? <p className="sidebar-list-empty">Your chats will appear here</p> : null}
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
        <button aria-controls="inko-assistant" aria-expanded={assistantOpen} aria-label={assistantOpen ? "Hide Inko assistant" : "Show Inko assistant"} className="assistant-rail-toggle" onClick={() => { closeSidebar(); setAssistantOpen((open) => !open); }} type="button"><MessageCircle size={21} /><span>Inko</span></button>
      </> : null}

      <nav className="mobile-nav" aria-label="Primary navigation">
        <button aria-label="New chat" onClick={newChat} type="button"><MessageSquarePlus size={20} /><span>Chat</span></button>
        <Link aria-current={pathname === "/projects" ? "page" : undefined} href="/projects"><FolderOpen size={20} /><span>Projects</span></Link>
        <Link aria-current={pathname === "/research" ? "page" : undefined} href="/research"><Search size={20} /><span>Research</span></Link>
        <Link aria-current={pathname === "/history" ? "page" : undefined} href="/history"><Clock3 size={20} /><span>History</span></Link>
      </nav>
    </div>
  );
}
