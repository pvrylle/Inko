"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/features/auth/auth-modal-provider";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Mic, Search, FileText, StickyNote, ArrowRight, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import { VoiceCapsule } from "@/features/voice/voice-capsule";
import { initialMascotState } from "@/features/mascot/mascot-state";
import type { MascotCharacter } from "@/features/mascot/sprite-manifest";

const ONBOARDING_KEY = "inko.hasCompletedOnboarding";

export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ONBOARDING_KEY) === "1";
}

export function markOnboardingComplete() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_KEY, "1");
}

const companions: { id: MascotCharacter; name: string; blurb: string }[] = [
  { id: "octopus", name: "Inko", blurb: "Curious octopus — research, reading, and debate." },
  { id: "mrclaws", name: "Mr Claws", blurb: "Detail crab — verification, compare, and sources." },
];

function SlideMascot({ state }: { state: ReturnType<typeof useMascot>["state"] }) {
  return (
    <div className="onboarding-mascot" aria-hidden="true">
      <InkoMascot character="octopus" state={state} className="onboarding-mascot-sprite" fit="contain" />
    </div>
  );
}

export function OnboardingFlow() {
  const reduced = useReducedMotion();
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [slide, setSlide] = useState(0);
  const { character, setCharacter, state: liveState } = useMascot();
  const totalSlides = 5;

  const slideState = (patch: Partial<typeof liveState>) => ({ ...liveState, ...patch });

  const slides = [
    // 0: Meet Inko
    {
      state: slideState({ presence: "idle", mood: "happy", emotion: "happy", message: "Nice to meet you!" }),
      content: (
        <div className="onboarding-slide-content">
          <span className="onboarding-eyebrow">Meet your study buddy</span>
          <h1>Your voice-first research companion</h1>
          <p>Ask questions out loud. Inko listens, researches, and quizzes you.</p>
          <button type="button" className="onboarding-cta" onClick={() => setSlide(1)}>
            Meet Inko <ArrowRight size={18} />
          </button>
        </div>
      ),
    },
    // 1: AssemblyAI
    {
      state: slideState({ presence: "listening", mood: "neutral", emotion: "focused", message: "I’m listening…" }),
      content: (
        <div className="onboarding-slide-content">
          <span className="onboarding-eyebrow">Gemini thinks, AssemblyAI speaks</span>
          <h1>Real-time voice conversations</h1>
          <p>AssemblyAI carries your voice. Gemini decides what Inko says, then speaks the answer back.</p>
          <div className="onboarding-voice-badge">
            <span className="onboarding-voice-dot" />
            <Mic size={15} />
            <span>Live voice</span>
          </div>
          <button type="button" className="onboarding-cta" onClick={() => setSlide(2)}>
            See how it works <ArrowRight size={18} />
          </button>
        </div>
      ),
    },
    // 2: How it works
    {
      state: slideState({ presence: "working", mood: "neutral", emotion: "focused", message: "Working on it…" }),
      content: (
        <div className="onboarding-slide-content">
          <span className="onboarding-eyebrow">How it works</span>
          <h1>Research, remember, focus</h1>
          <div className="onboarding-steps">
            <div className="onboarding-step">
              <span className="onboarding-step-icon" data-tone="blue"><Search size={18} /></span>
              <strong>Ask a question</strong>
              <small>Voice or text</small>
            </div>
            <div className="onboarding-step">
              <span className="onboarding-step-icon" data-tone="teal"><FileText size={18} /></span>
              <strong>Get sources</strong>
              <small>Findings & contradictions</small>
            </div>
            <div className="onboarding-step">
              <span className="onboarding-step-icon" data-tone="purple"><StickyNote size={18} /></span>
              <strong>Study</strong>
              <small>Flashcards, quizzes, focus</small>
            </div>
          </div>
          <button type="button" className="onboarding-cta" onClick={() => setSlide(3)}>
            Pick companion <ArrowRight size={18} />
          </button>
        </div>
      ),
    },
    // 3: Pick companion
    {
      state: slideState({ presence: "idle", mood: "happy", emotion: "happy", message: "Pick your buddy!" }),
      content: (
        <div className="onboarding-slide-content">
          <span className="onboarding-eyebrow">Your companion</span>
          <h1>Who will study with you?</h1>
          <div className="companion-picker onboarding-companion-picker" role="radiogroup" aria-label="Study companion">
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
                    <InkoMascot
                      character={id}
                      state={initialMascotState}
                      className="companion-preview-inko"
                      fit="contain"
                    />
                  </span>
                  <span className="companion-option-copy">
                    <strong>{name}</strong>
                    <small>{blurb}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" className="onboarding-cta" onClick={() => setSlide(4)}>
            Try the mic <ArrowRight size={18} />
          </button>
        </div>
      ),
    },
    // 4: Try mic + final choice
    {
      state: slideState({ presence: "listening", mood: "neutral", emotion: "curious", message: "Try speaking or typing." }),
      content: (
        <div className="onboarding-slide-content">
          <span className="onboarding-eyebrow">Try it now</span>
          <h1>Tap the mic and say hello</h1>
          <p>Without an account, your voice is processed in the browser and answered by Gemini.</p>
          <div className="onboarding-voice-preview">
            <VoiceCapsule />
          </div>
          <div className="onboarding-final-actions">
            <Link href="/" className="onboarding-cta onboarding-cta-secondary" onClick={markOnboardingComplete}>
              <Sparkles size={16} /> Explore first
            </Link>
            <button
              type="button"
              className="onboarding-cta"
              onClick={() => {
                markOnboardingComplete();
                openAuth("signup");
                router.push("/");
              }}
            >
              Create free account
            </button>
          </div>
        </div>
      ),
    },
  ];

  const current = slides[slide];

  return (
    <div className="onboarding-screen">
      <Link
        href="/"
        className="onboarding-skip"
        onClick={markOnboardingComplete}
        aria-label="Skip onboarding"
      >
        <X size={18} /> Skip
      </Link>

      <div className="onboarding-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            className="onboarding-slide"
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.35 }}
          >
            <SlideMascot state={current.state} />
            {current.content}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="onboarding-dots" role="tablist" aria-label="Onboarding steps">
        {Array.from({ length: totalSlides }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={slide === i}
            aria-label={`Step ${i + 1}`}
            className="onboarding-dot"
            data-active={slide === i}
            onClick={() => setSlide(i)}
          />
        ))}
      </div>
    </div>
  );
}
