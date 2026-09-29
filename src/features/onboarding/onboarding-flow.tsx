"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/features/auth/auth-modal-provider";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Layers3, MessageSquareText, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import { initialMascotState, type MascotState } from "@/features/mascot/mascot-state";
import type { MascotCharacter } from "@/features/mascot/sprite-manifest";

const ONBOARDING_KEY = "inko.hasCompletedOnboarding";
export const WELCOME_PROMPT_KEY = "inko.welcome-prompt";

export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ONBOARDING_KEY) === "1";
}

export function markOnboardingComplete() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_KEY, "1");
}

const companions: { id: MascotCharacter; name: string; blurb: string; line: string }[] = [
  { id: "octopus", name: "Inko", blurb: "Curious. Follows a question until it makes sense.", line: "Bring a question. I’ll stay with it." },
  { id: "mrclaws", name: "Mr Claws", blurb: "Careful. Checks the claim before you move on.", line: "I’ll check the details before we agree." },
];

const starters = [
  { icon: Search, label: "What caused World War I: alliances or nationalism?" },
  { icon: Layers3, label: "How does mitosis differ from meiosis?" },
  { icon: MessageSquareText, label: "Do genes or environment shape intelligence more?" },
];

const steps = ["Meet", "How it works", "Companion", "First question"] as const;

export function OnboardingFlow() {
  const reduced = useReducedMotion();
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const { character, setCharacter, state } = useMascot();
  const [step, setStep] = useState(0);
  const buddy = companions.find((item) => item.id === character) ?? companions[0];

  const mascot = (patch: Partial<MascotState>) => ({ ...state, ...patch, message: buddy.line });

  const begin = (prompt?: string) => {
    markOnboardingComplete();
    if (prompt) window.sessionStorage.setItem(WELCOME_PROMPT_KEY, prompt);
    router.push("/");
  };

  const slides = [
    {
      state: mascot({ presence: "idle", mood: "happy", emotion: "happy" }),
      content: (
        <>
          <span className="onboarding-eyebrow">Step 1 · Meet</span>
          <h1>A companion for the question in front of you</h1>
          <p>Inko listens, finds the evidence, and stays until the idea is clear.</p>
          <button type="button" className="onboarding-cta" onClick={() => setStep(1)}>
            Continue <ArrowRight size={18} />
          </button>
        </>
      ),
    },
    {
      state: mascot({ presence: "working", mood: "neutral", emotion: "focused" }),
      content: (
        <>
          <span className="onboarding-eyebrow">Step 2 · How it works</span>
          <h1>Research, argue, remember</h1>
          <div className="welcome-jobs">
            <div><Search size={16} /><strong>Sources</strong><small>Gather what the evidence says.</small></div>
            <div><MessageSquareText size={16} /><strong>Debate</strong><small>Take the other side of your claim.</small></div>
            <div><Layers3 size={16} /><strong>Cards</strong><small>Keep the idea so you can use it.</small></div>
          </div>
          <button type="button" className="onboarding-cta" onClick={() => setStep(2)}>
            Choose a companion <ArrowRight size={18} />
          </button>
        </>
      ),
    },
    {
      state: mascot({ presence: "idle", mood: "happy", emotion: "curious" }),
      content: (
        <>
          <span className="onboarding-eyebrow">Step 3 · Companion</span>
          <h1>Who studies with you?</h1>
          <div className="welcome-companions" role="radiogroup" aria-label="Study companion">
            {companions.map(({ id, name, blurb }) => {
              const selected = character === id;
              return (
                <button key={id} type="button" role="radio" aria-checked={selected} className="welcome-companion" data-selected={selected} onClick={() => setCharacter(id)}>
                  <span className="welcome-companion-mark" aria-hidden="true">
                    <InkoMascot character={id} state={initialMascotState} className="welcome-companion-sprite" fit="contain" />
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>{blurb}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" className="onboarding-cta" onClick={() => setStep(3)}>
            Pick a first question <ArrowRight size={18} />
          </button>
        </>
      ),
    },
    {
      state: mascot({ presence: "idle", mood: "happy", emotion: "happy" }),
      content: (
        <>
          <span className="onboarding-eyebrow">Step 4 · First question</span>
          <h1>Start with something real</h1>
          <p>Choose a question and it will be waiting in the chat.</p>
          <div className="welcome-questions">
            {starters.map(({ icon: Icon, label }) => (
              <button key={label} type="button" onClick={() => begin(label)}>
                <Icon size={15} />
                <span>{label}</span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
          <div className="onboarding-final-actions">
            <button type="button" className="onboarding-cta" onClick={() => begin()}>
              <Sparkles size={16} /> Blank chat
            </button>
            <button type="button" className="onboarding-cta onboarding-cta-secondary" onClick={() => { markOnboardingComplete(); openAuth("signup"); router.push("/"); }}>
              Create free account
            </button>
          </div>
        </>
      ),
    },
  ];

  const current = slides[step];

  return (
    <div className="onboarding-screen">
      <Link href="/" className="onboarding-skip" onClick={markOnboardingComplete} aria-label="Skip onboarding">
        <X size={18} /> Skip
      </Link>

      <div className="onboarding-card">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="onboarding-slide"
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -28 }}
            transition={{ duration: 0.32 }}
          >
            <div className="welcome-stage">
              <InkoMascot character={character} state={current.state} className="welcome-mascot" fit="contain" />
              <p className="welcome-bubble">{buddy.line}</p>
            </div>
            <div className="welcome-copy">{current.content}</div>
          </motion.div>
        </AnimatePresence>

        <div className="onboarding-progress" role="tablist" aria-label="Onboarding steps">
          {steps.map((label, index) => (
            <button key={label} type="button" role="tab" aria-selected={step === index} aria-label={`${label}, step ${index + 1} of ${steps.length}`} data-active={step === index} data-done={index < step} onClick={() => setStep(index)}>
              <span />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
