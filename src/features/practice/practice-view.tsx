"use client";

import { ArrowRight, BrainCircuit, Layers3, Timer } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { PageVoiceControl } from "@/features/voice/page-voice-control";

const modes = [
  { href: "/flashcards", label: "Flashcards", detail: "Review with spaced repetition", icon: Layers3, tone: "purple" },
  { href: "/quiz", label: "Practice quiz", detail: "Test recall one question at a time", icon: BrainCircuit, tone: "blue" },
  { href: "/focus", label: "Focus timer", detail: "Run a distraction-free study block", icon: Timer, tone: "mint" },
] as const;

export function PracticeView() {
  return (
    <div className="content-page page-enter">
      <PageHeading eyebrow="Challenge" title="Practice" description="Turn your research into recall. Choose how you want to challenge yourself today." action={<PageVoiceControl />} />
      <div className="study-shortcut-grid practice-grid">
        {modes.map(({ href, label, detail, icon: Icon, tone }) => (
          <Link className="study-shortcut" data-tone={tone} href={href} key={href}>
            <span><Icon size={19} /></span>
            <div><strong>{label}</strong><small>{detail}</small></div>
            <ArrowRight size={16} />
          </Link>
        ))}
      </div>
    </div>
  );
}
