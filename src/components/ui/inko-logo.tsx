"use client";

import Link from "next/link";
import { getMascotLogoUrl } from "@/features/mascot/sprite-manifest";

export function InkoLogo({ compact = false }: { compact?: boolean }) {
  const logoSrc = getMascotLogoUrl("octopus");

  return (
    <Link className="inko-logo" href="/" aria-label="Inko home">
      <span className="logo-mark" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static brand mark from generated sprites */}
        <img className="logo-mark-img" src={logoSrc} alt="" width={36} height={36} />
      </span>
      <span className="logo-text">
        <span className="logo-word">Inko</span>
        {!compact && <span className="logo-tagline">Research. Think. Grow.</span>}
      </span>
    </Link>
  );
}
