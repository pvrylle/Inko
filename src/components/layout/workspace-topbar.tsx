"use client";

import { Bell, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useAuthModal } from "@/features/auth/auth-modal-provider";
import { useOptionalProjects } from "@/features/projects/project-provider";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import { getGuestLimitStatus } from "@/lib/guest-limits";

function accountLabel(email: string | undefined, metadata: Record<string, unknown> | undefined) {
  const fullName = metadata && typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  const name = metadata && typeof metadata.name === "string" ? metadata.name.trim() : "";
  if (fullName) return fullName;
  if (name) return name;
  if (email) return email.split("@")[0] || "Account";
  return "Guest";
}

function initials(label: string) {
  const parts = label.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0]?.[0] ?? "G");
  return letters.toUpperCase();
}

export function WorkspaceTopbar() {
  const router = useRouter();
  const controller = useOptionalVoiceAgent();
  const projects = useOptionalProjects();
  const { user, isGuest } = useAuth();
  const { openAuth } = useAuthModal();
  const rootRef = useRef<HTMLElement>(null);
  const chatMenuId = useId();
  const noticeMenuId = useId();
  const [chatOpen, setChatOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const sessions = controller?.sessions.filter((session) => !session.archived_at) ?? [];
  const active = sessions.find((session) => session.id === controller?.activeSessionId);
  const title = active?.title || "New chat";
  const label = user ? accountLabel(user.email, user.user_metadata) : "Guest";

  useEffect(() => {
    if (!isGuest) {
      setLimitReached(false);
      return;
    }
    setLimitReached(getGuestLimitStatus().anyExceeded);
  }, [isGuest, noticeOpen]);

  useEffect(() => {
    if (!chatOpen && !noticeOpen) return;
    const close = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setChatOpen(false);
        setNoticeOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setChatOpen(false);
        setNoticeOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [chatOpen, noticeOpen]);

  const startChat = () => {
    projects?.activateProject(null);
    controller?.clearConversation();
    setChatOpen(false);
    router.push("/");
  };

  const openChat = (id: string) => {
    projects?.activateProject(projects.conversationProjects[id] ?? null);
    controller?.openConversation(id);
    setChatOpen(false);
    router.push("/");
  };

  return (
    <header className="workspace-topbar" ref={rootRef}>
      <div className="workspace-chat">
        <span className="workspace-chat-label">Chat</span>
        <button
          aria-controls={chatMenuId}
          aria-expanded={chatOpen}
          aria-haspopup="menu"
          className="workspace-chat-pill"
          onClick={() => { setNoticeOpen(false); setChatOpen((open) => !open); }}
          type="button"
        >
          <i className="workspace-chat-dot" aria-hidden="true" />
          <strong title={title}>{title}</strong>
          <ChevronDown size={16} />
        </button>
        {chatOpen ? (
          <div className="workspace-menu" id={chatMenuId} role="menu">
            {sessions.length ? sessions.map((session) => (
              <button aria-current={session.id === active?.id ? "true" : undefined} key={session.id} onClick={() => openChat(session.id)} role="menuitem" type="button">
                <i aria-hidden="true" />
                <span>{session.title || "New chat"}</span>
              </button>
            )) : <p>No chats yet</p>}
            <button className="workspace-menu-new" onClick={startChat} role="menuitem" type="button"><Plus size={14} /> New chat</button>
          </div>
        ) : null}
      </div>
      <div className="workspace-topbar-end">
        <div className="workspace-notice">
          <button
            aria-controls={noticeMenuId}
            aria-expanded={noticeOpen}
            aria-label={limitReached ? "Notifications, guest limit reached" : "Notifications"}
            className="workspace-bell"
            onClick={() => { setChatOpen(false); setNoticeOpen((open) => !open); }}
            type="button"
          >
            <Bell size={16} />
            {limitReached ? <span className="workspace-bell-dot" /> : null}
          </button>
          {noticeOpen ? (
            <div className="workspace-menu workspace-notice-menu" id={noticeMenuId} role="menu">
              {limitReached ? (
                <>
                  <p>Guest limit reached. Create a free account to keep your work.</p>
                  <button onClick={() => { setNoticeOpen(false); openAuth("signup"); }} role="menuitem" type="button">Create account</button>
                </>
              ) : <p>No new notifications</p>}
            </div>
          ) : null}
        </div>
        {user ? (
          <Link className="workspace-profile" href="/settings">
            <span className="workspace-avatar" aria-hidden="true">{initials(label)}</span>
            <span className="workspace-profile-name">{label}</span>
          </Link>
        ) : (
          <button className="workspace-profile" onClick={() => openAuth("signup")} type="button">
            <span className="workspace-avatar" aria-hidden="true">{initials(label)}</span>
            <span className="workspace-profile-name">{label}</span>
          </button>
        )}
      </div>
    </header>
  );
}
