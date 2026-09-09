import { ArrowRight, BookOpen, Brain, Clock3, Sparkles } from "lucide-react";
import Link from "next/link";
import { MascotStage } from "@/features/mascot/mascot-stage";
import { VoicePanel } from "@/features/voice/voice-panel";
import { TodaySnapshot } from "@/features/home/today-snapshot";

export default function HomePage() {
  return (
    <div className="home-page page-enter">
      <div className="home-orbs" aria-hidden="true">
        <span className="home-orb home-orb-1" />
        <span className="home-orb home-orb-2" />
        <span className="home-orb home-orb-3" />
      </div>

      <section className="home-copy">
        <p className="eyebrow"><Sparkles aria-hidden="true" size={15} /> Your study buddy is ready</p>
        <h1>Hey, I&apos;m <span>Inko!</span></h1>
        <p className="home-lede">Tell me what you&apos;re learning. I&apos;ll turn it into notes, cards, quizzes, and a plan that sticks.</p>
      </section>

      <MascotStage />

      <VoicePanel />

      <TodaySnapshot />

      <section className="quick-start">
        <div className="section-title-row">
          <div><p className="eyebrow">Jump back in</p><h2>Ready when you are</h2></div>
          <Link className="section-link" href="/library">View library <ArrowRight size={16} /></Link>
        </div>
        <div className="quick-grid">
          <Link className="quick-card violet" href="/library">
            <span><BookOpen size={20} /></span>
            <div><strong>Capture a note</strong><small>Speak freely. I&apos;ll tidy it up.</small></div>
          </Link>
          <Link className="quick-card coral" href="/flashcards">
            <span>✦</span>
            <div><strong>Review cards</strong><small>Your next review will appear here.</small></div>
          </Link>
          <Link className="quick-card aqua" href="/quiz">
            <span><Brain size={20} /></span>
            <div><strong>Take a quiz</strong><small>Grounded questions from your notes.</small></div>
          </Link>
          <Link className="quick-card amber" href="/focus">
            <span><Clock3 size={20} /></span>
            <div><strong>Start focus</strong><small>25 minutes on one thing.</small></div>
          </Link>
        </div>
      </section>
    </div>
  );
}
