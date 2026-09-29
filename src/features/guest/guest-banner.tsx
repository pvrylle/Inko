"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useAuthModal } from "@/features/auth/auth-modal-provider";
import { getGuestLimitStatus } from "@/lib/guest-limits";

export function GuestBanner() {
  const { isGuest } = useAuth();
  const { openAuth } = useAuthModal();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!isGuest || !ready) return null;
  const status = getGuestLimitStatus();
  if (!status.anyNear && !status.anyExceeded) return null;

  return (
    <div className="guest-banner" data-urgent={status.anyExceeded} role="status">
      <span className="guest-banner-text">
        {status.anyExceeded
          ? "Guest limit reached. Create a free account to unlock live voice and keep your work."
          : "You’re near the guest limit. Create a free account to keep going."}
      </span>
      <button type="button" className="guest-banner-action" onClick={() => openAuth("signup")}>
        <Sparkles size={14} /> Unlock
      </button>
    </div>
  );
}
