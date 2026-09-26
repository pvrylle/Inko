"use client";

import { Palette, Radio, ShieldCheck, User } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import { initialMascotState } from "@/features/mascot/mascot-state";
import type { MascotCharacter } from "@/features/mascot/sprite-manifest";
import { AuthForm } from "@/features/auth/auth-form";

const sections = [
  {
    icon: Radio,
    tone: "blue",
    title: "Voice & AssemblyAI",
    items: [
      "Live conversation streams directly to AssemblyAI.",
      "Say “Hey Inko” or tap the microphone to start a session.",
      "You can interrupt Inko at any time while it speaks.",
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
      "Inko does not store your microphone audio.",
      "Provider sessions are deleted when a conversation ends.",
      "Your research and notes stay scoped to your account.",
    ],
  },
] as const;

const companions: { id: MascotCharacter; name: string; blurb: string }[] = [
  { id: "octopus", name: "Inko", blurb: "Curious octopus — research, reading, and debate." },
  { id: "mrclaws", name: "Mr Claws", blurb: "Detail crab — verification, compare, and sources." },
];

export function SettingsView() {
  const { character, setCharacter, state } = useMascot();
  const previewState = { ...initialMascotState, ...state, presence: "idle" as const, mood: "neutral" as const };

  return (
    <div className="content-page page-enter">
      <PageHeading eyebrow="Preferences" title="Settings" description="How Inko listens, looks, and protects your work." />

      <section className="settings-card" aria-labelledby="account-heading">
        <div className="settings-card-head">
          <span className="settings-card-icon" data-tone="blue"><User size={17} /></span>
          <h2 id="account-heading">Account</h2>
        </div>
        <AuthForm />
      </section>

      <section className="settings-card settings-companion-card" aria-labelledby="companion-heading">
        <div className="settings-card-head">
          <span className="settings-card-icon" data-tone="coral"><Palette size={17} /></span>
          <h2 id="companion-heading">Study companion</h2>
        </div>
        <p className="settings-companion-lead">
          Pick who appears across Home, Research, and Focus. Sprites follow the tools and emotions of each session.
        </p>
        <div className="companion-picker" role="radiogroup" aria-label="Study companion">
          {companions.map(({ id, name, blurb }) => {
            const selected = character === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                className="companion-option"
                data-selected={selected}
                onClick={() => setCharacter(id)}
              >
                <span className="companion-option-mascot" aria-hidden="true">
                  <InkoMascot character={id} state={previewState} className="companion-preview-inko" fit="contain" />
                </span>
                <span className="companion-option-copy">
                  <strong>{name}</strong>
                  <small>{blurb}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

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
