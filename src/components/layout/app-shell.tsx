"use client";

import { AudioLines, Clock, LayoutGrid, Globe, Home, Search, Settings, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { InkoLogo } from "@/components/ui/inko-logo";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { useMascot } from "@/features/mascot/mascot-provider";
import { MascotOverlay } from "@/features/mascot/mascot-overlay";
import { PersistentVoiceDock } from "@/features/voice/voice-dock";
import { useOptionalVoiceAgent } from "@/features/voice/voice-agent-provider";
import { GuestBanner } from "@/features/guest/guest-banner";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label?: string; items: NavItem[] };

const navigationGroups: NavGroup[] = [
  {
    items: [{ href: "/", label: "Home", icon: Home }],
  },
  {
    label: "Research",
    items: [
      { href: "/research", label: "Research", icon: Search },
      { href: "/sources", label: "Sources", icon: FileText },
      { href: "/canvas", label: "Canvas", icon: LayoutGrid },
    ],
  },
  {
    label: "Challenge",
    items: [{ href: "/practice", label: "Practice", icon: Globe }],
  },
  {
    label: "History",
    items: [
      { href: "/history", label: "History", icon: Clock },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const mobileNavigation: NavItem[] = navigationGroups.flatMap((group) => group.items);

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { state } = useMascot();
  const controller = useOptionalVoiceAgent();
  const listening = controller?.connection === "connected" || controller?.connection === "connecting";

  const isBare = pathname === "/welcome";
  if (isBare) {
    return <>{children}</>;
  }

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <aside className="desktop-sidebar" aria-label="Primary navigation">
        <div className="sidebar-brand"><InkoLogo /></div>

        <div className="sidebar-navigation">
          {navigationGroups.map((group, index) => (
            <section className="nav-group" key={group.label ?? `group-${index}`} aria-label={group.label ?? "Primary"}>
              {group.label && <p className="nav-group-label">{group.label}</p>}
              <nav className="desktop-nav">
                {group.items.map(({ href, icon: Icon, label }) => (
                  <Link aria-current={isActive(pathname, href) ? "page" : undefined} className="nav-link" data-active={isActive(pathname, href)} href={href} key={href}>
                    <span className="nav-link-icon"><Icon aria-hidden="true" size={19} strokeWidth={2.1} /></span>
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>
            </section>
          ))}
        </div>

        <div className="sidebar-user" data-listening={listening}>
          <span className="sidebar-user-avatar" aria-hidden="true"><InkoMascot character="octopus" state={state} className="sidebar-user-inko" fit="cover" /></span>
          <span className="sidebar-user-body">
            <strong>Inko</strong>
            <small><i /> Ready to listen</small>
          </span>
          <AudioLines aria-hidden="true" className="sidebar-user-wave" size={17} />
        </div>
      </aside>

      <header className="mobile-header">
        <InkoLogo compact />
      </header>

      <GuestBanner />

      <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>

      <MascotOverlay />
      <PersistentVoiceDock />

      <nav className="mobile-nav" aria-label="Primary navigation">
        {mobileNavigation.map(({ href, icon: Icon, label }) => (
          <Link aria-current={isActive(pathname, href) ? "page" : undefined} className="mobile-nav-link" data-active={isActive(pathname, href)} href={href} key={href}>
            <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
