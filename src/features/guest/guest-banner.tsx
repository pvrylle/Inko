"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { getGuestLimitStatus } from "@/lib/guest-limits";

export function GuestBanner() {
  const { isGuest } = useAuth();
  const status = getGuestLimitStatus();

  if (!isGuest) return null;
  if (!status.anyNear && !status.anyExceeded) return null;

  return (
    <div className="guest-banner" data-urgent={status.anyExceeded} role="status">
      <span className="guest-banner-text">
        {status.anyExceeded
          ? "Guest limit reached. Create a free account to unlock live AssemblyAI voice and keep your work."
          : "You’re near the guest limit. Create a free account to keep going."}
      </span>
      <Link href="/settings" className="guest-banner-action">
        <Sparkles size={14} /> Unlock
      </Link>
    </div>
  );
}
