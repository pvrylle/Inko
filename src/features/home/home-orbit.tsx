"use client";

import { Check, MessageSquareText, MoreHorizontal, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ContentTopbar } from "@/components/layout/content-topbar";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import { HomeChat } from "./home-chat";

export function HomeOrbit() {
  const controller = useOptionalVoiceAgent();
  const [desktopSessionsOpen, setDesktopSessionsOpen] = useState(true);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [menuOpensUp, setMenuOpensUp] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const newConversationRef = useRef<HTMLButtonElement>(null);
  const sessions = controller?.sessions;
  const openConversation = controller?.openConversation;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 1150px)");
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!sessions?.length || !openConversation) return;
    const requested = new URLSearchParams(window.location.search).get("chat");
    if (requested) openConversation(requested);
  }, [sessions, openConversation]);

  useEffect(() => {
    if (!menuSessionId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuSessionId(null);
      setDeletingSessionId(null);
      menuTriggerRef.current?.focus();
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (menuRef.current?.contains(event.target) || menuTriggerRef.current?.contains(event.target)) return;
      setMenuSessionId(null);
      setDeletingSessionId(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [menuSessionId]);

  useEffect(() => {
    if (deletingSessionId) deleteCancelRef.current?.focus();
  }, [deletingSessionId]);

  if (!controller) return null;

  const sessionsOpen = isNarrow ? mobileSessionsOpen : desktopSessionsOpen;
  const newConversation = () => {
    window.history.replaceState(null, "", "/");
    controller.clearConversation();
    setMobileSessionsOpen(false);
    setMenuSessionId(null);
  };

  return (
    <div className="home-screen home-screen-chat home-companion-page page-enter">
      <ContentTopbar />
      <div className="home-companion-workspace" data-desktop-sessions-open={desktopSessionsOpen} data-mobile-sessions-open={mobileSessionsOpen}>
        {mobileSessionsOpen ? (
          <button
            aria-label="Close conversations"
            className="home-conversations-scrim"
            onClick={() => setMobileSessionsOpen(false)}
            type="button"
          />
        ) : null}
        <aside className="home-conversations" id="home-conversations" aria-label="Conversations">
          <div className="home-conversations-heading">
            <h2>Conversations</h2>
            <button aria-label="New conversation" className="home-conversations-add" onClick={newConversation} ref={newConversationRef} type="button">
              <Plus aria-hidden="true" size={17} />
            </button>
          </div>
          <div className="home-conversations-list">
            {controller.sessionError ? <p className="home-conversations-error" role="status">{controller.sessionError}</p> : null}
            {controller.sessions.length === 0 ? (
              <p className="home-conversations-empty">Your conversations will appear here.</p>
            ) : (
              controller.sessions.map((session) => (
                <div className="home-conversation-row" key={session.id}>
                  {editingSessionId === session.id ? (
                    <form
                      className="home-conversation-rename"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (draftTitle.trim()) controller.renameConversation(session.id, draftTitle);
                        setEditingSessionId(null);
                      }}
                    >
                      <input
                        aria-label="Conversation title"
                        autoFocus
                        maxLength={160}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setEditingSessionId(null);
                        }}
                        value={draftTitle}
                      />
                      <button aria-label="Save title" type="submit"><Check aria-hidden="true" size={15} /></button>
                      <button aria-label="Cancel rename" onClick={() => setEditingSessionId(null)} type="button"><X aria-hidden="true" size={15} /></button>
                    </form>
                  ) : (
                    <>
                      <button
                        aria-current={session.id === controller.activeSessionId ? "true" : undefined}
                        className="home-conversation-item"
                        data-active={session.id === controller.activeSessionId}
                        onClick={() => {
                          window.history.replaceState(null, "", `/?chat=${encodeURIComponent(session.id)}`);
                          void controller.openConversation(session.id);
                          setMobileSessionsOpen(false);
                          setMenuSessionId(null);
                        }}
                        type="button"
                      >
                        <MessageSquareText aria-hidden="true" size={16} />
                        <span>{session.title || "New conversation"}</span>
                      </button>
                      <button
                        aria-expanded={menuSessionId === session.id}
                        aria-label={`Options for ${session.title || "New conversation"}`}
                        className="home-conversation-options"
                        onClick={(event) => {
                          menuTriggerRef.current = event.currentTarget;
                          const listBottom = event.currentTarget.closest(".home-conversations-list")?.getBoundingClientRect().bottom ?? window.innerHeight;
                          setMenuOpensUp(listBottom - event.currentTarget.getBoundingClientRect().bottom < 120);
                          setMenuSessionId((current) => current === session.id ? null : session.id);
                          setDeletingSessionId(null);
                        }}
                        type="button"
                      >
                        <MoreHorizontal aria-hidden="true" size={16} />
                      </button>
                    </>
                  )}
                  {menuSessionId === session.id && editingSessionId !== session.id ? (
                    <div aria-label={`Options for ${session.title || "New conversation"}`} className="home-conversation-menu" data-opens-up={menuOpensUp} ref={menuRef} role="group">
                      {deletingSessionId === session.id ? (
                        <>
                          <p role="alert">Delete this conversation?</p>
                          <div className="home-conversation-menu-actions">
                            <button
                              onClick={() => {
                                setDeletingSessionId(null);
                                window.requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
                              }}
                              ref={deleteCancelRef}
                              type="button"
                            >Cancel</button>
                            <button
                              className="home-conversation-delete"
                              onClick={() => {
                                if (controller.activeSessionId === session.id) window.history.replaceState(null, "", "/");
                                controller.removeConversation(session.id);
                                setMenuSessionId(null);
                                setDeletingSessionId(null);
                                newConversationRef.current?.focus();
                              }}
                              type="button"
                            >Delete</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setDraftTitle(session.title || "New conversation");
                              setEditingSessionId(session.id);
                              setMenuSessionId(null);
                            }}
                            type="button"
                          >Rename</button>
                          <button className="home-conversation-delete" onClick={() => setDeletingSessionId(session.id)} type="button">Delete</button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </aside>
        <HomeChat
          controller={controller}
          key={controller.activeSessionId ?? "new"}
          onNewSession={newConversation}
          onToggleSessions={() => {
            if (isNarrow) setMobileSessionsOpen((open) => !open);
            else setDesktopSessionsOpen((open) => !open);
          }}
          sessionsOpen={sessionsOpen}
        />
      </div>
    </div>
  );
}
