"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useAuthModal } from "@/features/auth/auth-modal-provider";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

function metadataName(metadata: { full_name?: unknown; name?: unknown } | undefined) {
  const fullName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : "";
  const name = typeof metadata?.name === "string" ? metadata.name.trim() : "";
  return fullName || name;
}

function initials(label: string) {
  const parts = label.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : (parts[0]?.[0] ?? "G");
  return letters.toUpperCase();
}

function AccountChip() {
  const { user, isReady } = useAuth();
  const { openAuth } = useAuthModal();
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!user) {
      setProfileName("");
      return;
    }
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      const stored = data?.display_name?.trim() ?? "";
      if (!cancelled && stored && stored !== "Study buddy") setProfileName(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const label = user ? metadataName(user.user_metadata) || profileName || user.email?.split("@")[0] || "Account" : "Guest";
  const body = (
    <>
      <span className="topbar-avatar" aria-hidden="true">{initials(label)}</span>
      <span className="topbar-account-name">{label}</span>
    </>
  );

  if (!isReady) return null;
  if (user) {
    return <Link className="topbar-account" href="/settings">{body}</Link>;
  }
  return <button className="topbar-account" onClick={() => openAuth("signup")} type="button">{body}</button>;
}

export function ContentTopbar({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`content-topbar ${className}`.trim()}>
      {children}
      <AccountChip />
    </div>
  );
}
