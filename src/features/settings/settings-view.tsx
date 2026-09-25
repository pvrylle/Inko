"use client";

import { Palette, Radio, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";

const sections = [
  {
    icon: Radio,
    tone: "blue",
    title: "Voice & AssemblyAI",
    items: [
      "Live conversation streams directly to AssemblyAI.",
      "Say “Hey Tentaio” or tap the microphone to start a session.",
      "You can interrupt Tentaio at any time while it speaks.",
    ],
  },
  {
    icon: Palette,
    tone: "purple",
    title: "Appearance",
    items: [
      "Calm light theme tuned for long research sessions.",
      "Reduced-motion is respected automatically from your system.",
    ],
  },
  {
    icon: ShieldCheck,
    tone: "teal",
    title: "Privacy & data",
    items: [
      "Tentaio does not store your microphone audio.",
      "Provider sessions are deleted when a conversation ends.",
      "Your research and notes stay scoped to your account.",
    ],
  },
] as const;

export function SettingsView() {
  return (
    <div className="content-page page-enter">
      <PageHeading eyebrow="History" title="Settings" description="How Tentaio listens, looks, and protects your work." />
      <div className="settings-grid">
        {sections.map(({ icon: Icon, tone, title, items }) => (
          <section className="settings-card" key={title}>
            <div className="settings-card-head"><span className="settings-card-icon" data-tone={tone}><Icon size={17} /></span><h2>{title}</h2></div>
            <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}
