"use client";

import { ArrowRight, MessageSquareText, Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentTopbar } from "@/components/layout/content-topbar";
import { useOptionalProjects } from "@/features/projects/project-provider";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";

export function DebateView({ initialTopic = "" }: { initialTopic?: string }) {
  const router = useRouter();
  const companion = useOptionalVoiceAgent();
  const projects = useOptionalProjects();
  const [topic, setTopic] = useState(initialTopic);
  const [draftTopic, setDraftTopic] = useState(initialTopic);
  const [argument, setArgument] = useState("");

  const begin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draftTopic.trim().slice(0, 200);
    if (!next) return;
    setTopic(next);
    setArgument("");
    const href = `/debate?topic=${encodeURIComponent(next)}`;
    router.replace(href);
    projects?.addActivity("debate", next, href);
  };

  const submitArgument = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = argument.trim();
    if (!text || companion?.replyPending) return;
    setArgument("");
    void companion?.sendText(text);
  };

  const latestStudent = [...(companion?.messages ?? [])].reverse().find((message) => message.role === "student");
  const latestInko = [...(companion?.messages ?? [])].reverse().find((message) => message.role === "inko");

  return (
    <div className="activity-workspace page-enter">
      <ContentTopbar />
      <div className="activity-content">
        <header className="activity-heading"><span className="workspace-eyebrow">Debate</span><h1>{topic || "Find the other side"}</h1><p>{topic ? "Make your case. Inko will challenge your reasoning." : "Choose a question worth arguing about."}</p></header>
        {!topic ? (
          <form className="debate-topic-form" onSubmit={begin}>
            <label htmlFor="debate-topic">Topic</label>
            <div><input autoFocus id="debate-topic" maxLength={200} onChange={(event) => setDraftTopic(event.target.value)} placeholder="Should AI tutors replace lectures?" required value={draftTopic} /><button type="submit">Start debate <ArrowRight size={17} /></button></div>
          </form>
        ) : (
          <>
            <div className="debate-stage">
              <section aria-labelledby="debate-you-heading"><span className="debate-side-mark">01</span><h2 id="debate-you-heading">Your position</h2><p>{latestStudent?.text || "Make your opening argument below."}</p></section>
              <section aria-labelledby="debate-inko-heading"><span className="debate-side-mark">02</span><h2 id="debate-inko-heading">Inko&apos;s response</h2><p>{companion?.replyPending ? "Thinking through your point..." : latestInko?.text || "I'll respond with the strongest counterargument."}</p></section>
            </div>
            <form className="debate-argument-form" onSubmit={submitArgument}>
              <label htmlFor="debate-argument">Your argument</label>
              <textarea id="debate-argument" maxLength={4000} onChange={(event) => setArgument(event.target.value)} placeholder="I think..." rows={4} value={argument} />
              <div><button className="workspace-command" disabled={!argument.trim() || companion?.replyPending} type="submit"><Send size={17} /> Send argument</button><button onClick={() => { setTopic(""); setDraftTopic(""); router.replace("/debate"); }} type="button">Change topic</button></div>
            </form>
          </>
        )}
        <div className="activity-footer"><MessageSquareText size={17} /> You can keep talking to Inko on the right.</div>
      </div>
    </div>
  );
}
