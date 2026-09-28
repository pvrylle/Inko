"use client";

import { Clock3, FileText, FolderOpen, Library, MessageCircle, MessageSquarePlus, Plus, Search, Settings } from "lucide-react";
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

  if (pathname === "/welcome") return <>{children}</>;

  const newChat = () => {
    controller?.clearConversation();
    router.push("/");
    setAssistantOpen(false);
  };

  const openProject = (id: string) => {
    projects?.activateProject(id);
    const latest = controller?.sessions.find((session) => projects?.conversationProjects[session.id] === id);
    if (latest) controller?.openConversation(latest.id);
    else controller?.clearConversation();
    router.push("/");
    setAssistantOpen(false);
  };

  const openAllChats = () => {
    projects?.activateProject(null);
    const latest = controller?.sessions.find((session) => !projects?.conversationProjects[session.id]);
    if (latest) controller?.openConversation(latest.id);
    else controller?.clearConversation();
    router.push("/");
    setAssistantOpen(false);
  };

  const recent = controller?.sessions.filter((session) => (projects?.conversationProjects[session.id] ?? null) === (projects?.activeId ?? null)).slice(0, 8) ?? [];

  return (
    <div className="app-frame assistant-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="desktop-sidebar" aria-label="Primary navigation">
        <div className="sidebar-brand"><InkoLogo /></div>
        <button className="sidebar-new-chat" onClick={newChat} type="button"><MessageSquarePlus size={18} /> New chat</button>
        <nav className="sidebar-primary-nav" aria-label="Workspace">
          {links.map(({ href, icon: Icon, label }) => <Link aria-current={pathname === href ? "page" : undefined} href={href} key={href}><Icon size={17} /><span>{label}</span></Link>)}
        </nav>
        <div className="sidebar-scroll">
          <section className="sidebar-list-section" aria-label="Projects">
            <div className="sidebar-list-heading"><span>Projects</span><Link aria-label="Create project" href="/projects?new=1" title="Create project"><Plus size={16} /></Link></div>
            <button aria-current={!projects?.activeId ? "true" : undefined} className="sidebar-list-item" onClick={openAllChats} type="button"><MessageCircle size={15} /><span>All chats</span></button>
            {projects?.projects.map((project) => <button aria-current={project.id === projects.activeId ? "true" : undefined} className="sidebar-list-item" key={project.id} onClick={() => openProject(project.id)} type="button"><FolderOpen size={15} /><span>{project.name}</span></button>)}
            {!projects?.projects.length ? <p className="sidebar-list-empty">No projects yet</p> : null}
          </section>
          <section className="sidebar-list-section" aria-label="Recent chats">
            <div className="sidebar-list-heading"><span>Recents</span></div>
            {recent.map((session) => <button aria-current={session.id === controller?.activeSessionId ? "true" : undefined} className="sidebar-list-item" key={session.id} onClick={() => { controller?.openConversation(session.id); router.push("/"); }} type="button"><span>{session.title || "New chat"}</span></button>)}
            {!recent.length ? <p className="sidebar-list-empty">Your chats will appear here</p> : null}
          </section>
        </div>
        <Link aria-current={pathname === "/settings" ? "page" : undefined} className="sidebar-settings" href="/settings"><Settings size={17} /> Settings</Link>
      </aside>

      <header className="mobile-header"><InkoLogo compact /><button aria-label="New chat" onClick={newChat} title="New chat" type="button"><MessageSquarePlus size={20} /></button></header>
      <GuestBanner />
      <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>

      {controller ? <>
        {assistantOpen ? <button aria-label="Close assistant" className="assistant-rail-scrim" onClick={() => setAssistantOpen(false)} type="button" /> : null}
        <aside className="assistant-rail" data-open={assistantOpen}><HomeChat controller={controller} home={pathname === "/"} onClose={() => setAssistantOpen(false)} /></aside>
        <button aria-label="Open assistant" className="assistant-rail-toggle" onClick={() => setAssistantOpen(true)} type="button"><MessageCircle size={21} /><span>Inko</span></button>
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
