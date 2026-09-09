"use client";

import { BarChart3, BookOpen, Brain, Clock3, Home, Layers3 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { InkoLogo } from "@/components/ui/inko-logo";
import { useProgress } from "@/features/progress/use-progress";

const navigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/flashcards", label: "Cards", icon: Layers3 },
  { href: "/quiz", label: "Quiz", icon: Brain },
  { href: "/focus", label: "Focus", icon: Clock3 },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { summary } = useProgress();

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="desktop-sidebar" aria-label="Primary navigation">
        <InkoLogo />
        <nav className="desktop-nav">
          {navigation.map(({ href, icon: Icon, label }) => (
            <Link aria-current={isActive(pathname, href) ? "page" : undefined} className="nav-link" data-active={isActive(pathname, href)} href={href} key={href}>
              <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <Link aria-current={isActive(pathname, "/progress") ? "page" : undefined} className="progress-link" data-active={isActive(pathname, "/progress")} href="/progress">
          <span className="progress-icon"><BarChart3 aria-hidden="true" size={18} /></span>
          <span><strong>{summary.streak} day streak</strong><small>Keep it glowing</small></span>
        </Link>
      </aside>

      <div className="mobile-header">
        <InkoLogo compact />
        <Link aria-current={isActive(pathname, "/progress") ? "page" : undefined} aria-label={`Open progress, ${summary.streak} day streak`} className="streak-pill" data-active={isActive(pathname, "/progress")} href="/progress">🔥 {summary.streak}</Link>
      </div>

      <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>

      <nav className="mobile-nav" aria-label="Primary navigation">
        {navigation.map(({ href, icon: Icon, label }) => (
          <Link aria-current={isActive(pathname, href) ? "page" : undefined} className="mobile-nav-link" data-active={isActive(pathname, href)} href={href} key={href}>
            <Icon aria-hidden="true" size={21} strokeWidth={2.2} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
