"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  AudioLines,
  FileText,
  FolderClosed,
  Globe,
  LayoutGrid,
  Lightbulb,
  Search,
  Share2,
  StickyNote,
  Target,
} from "lucide-react";
import Link from "next/link";
import { ContentTopbar } from "@/components/layout/content-topbar";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import { useResearch } from "@/features/research/use-research";
import { VoiceCapsule } from "@/features/voice/voice-capsule";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import { HomeChat } from "./home-chat";

const prompts = [
  { text: "Research the effects of AI on education", icon: Search, tone: "blue" },
  { text: "Find studies that contradict each other", icon: FileText, tone: "teal" },
  { text: "Show me the sources for this claim", icon: LayoutGrid, tone: "purple" },
  { text: "Challenge my conclusion", icon: Globe, tone: "coral" },
  { text: "Put the findings on the canvas", icon: Share2, tone: "violet" },
  { text: "Save this as a research note", icon: StickyNote, tone: "indigo" },
] as const;

const quickTips = [
  { text: "Be specific with your topic for better results.", icon: Search, tone: "blue" },
  { text: "You can interrupt me anytime.", icon: AudioLines, tone: "teal" },
  { text: "I'll always cite my sources.", icon: FileText, tone: "purple" },
] as const;

const railFolderTones = ["blue", "teal", "purple"] as const;

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function HomeOrbit() {
  const reduced = useReducedMotion();
  const { state, amplitude } = useMascot();
  const controller = useOptionalVoiceAgent();
  const { sessions, createSession, startNewProject } = useResearch();
  const recent = sessions.slice(0, 3);
  const chatting = (controller?.messages ?? []).some((message) => message.role === "student");

  const onPrompt = (text: string) => {
    if (!controller) return;
    void controller.sendText(text);
  };

  return (
    <div className={`home-screen page-enter${chatting ? " home-screen-chat" : ""}`}>
      <ContentTopbar />

      {chatting && controller ? (
        <HomeChat
          controller={controller}
          createSession={createSession}
          onNewSession={() => {
            controller.clearConversation();
            startNewProject();
          }}
        />
      ) : null}

      {chatting ? null : <div className="home-screen-grid">
        <section className="home-console" aria-label="Talk to Inko">
          <motion.div
            className="home-console-mascot"
            animate={{ opacity: 1, y: 0 }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.4 }}
          >
            <InkoMascot state={state} amplitude={amplitude} className="home-mascot" fit="contain" />
          </motion.div>

          <h1 className="home-console-title">Hey <span>Inko!</span></h1>
          <p className="home-console-sub">What would you like to investigate today?</p>

          <VoiceCapsule />

          <div className="home-prompts" aria-label="Try saying">
            <p className="home-prompts-label">Try saying…</p>
            <div className="prompt-grid">
              {prompts.map(({ text, icon: Icon, tone }) => (
                <button className="prompt-card" data-tone={tone} key={text} onClick={() => onPrompt(text)} type="button">
                  <span className="prompt-card-icon"><Icon size={17} /></span>
                  <span className="prompt-card-text">&ldquo;{text}&rdquo;</span>
                </button>
              ))}
            </div>
          </div>

          <p className="home-console-footer">Better questions. Deeper understanding.</p>
        </section>

        <aside className="home-rail" aria-label="Your research overview">
          <article className="rail-card">
            <div className="rail-card-head">
              <span className="rail-card-title"><FolderClosed size={15} /> Recent Research</span>
              <Link className="rail-view-all" href="/research">View all <ArrowRight size={12} /></Link>
            </div>
            {recent.length === 0 ? (
              <p className="rail-empty">No research yet. Ask a question to begin your first project.</p>
            ) : (
              <ul className="recent-research-list">
                {recent.map((session, index) => {
                  const subtitle = "Research project";
                  return (
                    <li key={session.id}>
                      <Link className="recent-research-item" href={`/research?session=${session.id}`}>
                        <span className="recent-research-folder" data-tone={railFolderTones[index % railFolderTones.length]}><FolderClosed size={16} /></span>
                        <span className="recent-research-body">
                          <strong>{session.title ?? session.question}</strong>
                          <small>{subtitle}</small>
                        </span>
                        <span className="recent-research-time">{relativeTime(session.updated_at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>

          <article className="rail-card your-focus-card">
            <span className="rail-card-title"><Target size={15} /> Your Focus</span>
            <div className="your-focus-quote">
              <span className="your-focus-mascot" aria-hidden="true"><InkoMascot state={state} className="your-focus-inko" fit="cover" /></span>
              <p>&ldquo;Small steps in research lead to big breakthroughs.&rdquo;</p>
              <cite>— Inko</cite>
            </div>
          </article>

          <article className="rail-card">
            <span className="rail-card-title"><Lightbulb size={15} /> Quick Tips</span>
            <ul className="quick-tips-list">
              {quickTips.map(({ text, icon: Icon, tone }) => (
                <li key={text}>
                  <span className="quick-tip-icon" data-tone={tone}><Icon size={14} /></span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </div>}
    </div>
  );
}
