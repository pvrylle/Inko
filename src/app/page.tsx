import { Sparkles } from "lucide-react";
import { HomeOrbit } from "@/features/home/home-orbit";
import { RecentNotesStrip } from "@/features/home/recent-notes-strip";

export default function HomePage() {
  return (
    <div className="home-page page-enter">
      <section className="home-copy">
        <p className="eyebrow"><Sparkles aria-hidden="true" size={15} /> Your study buddy is ready</p>
        <h1>Hey, I&apos;m <span>Inko!</span></h1>
        <p className="home-lede">Tell me what you&apos;re learning. I&apos;ll turn it into notes, cards, quizzes, and a plan that sticks.</p>
      </section>

      <HomeOrbit />

      <RecentNotesStrip />
    </div>
  );
}
