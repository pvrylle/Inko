"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

function initialsFromEmail(email: string | undefined) {
  if (!email) return "IN";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return (local.slice(0, 2) || "IN").toUpperCase();
}

export function ContentTopbar({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const { user, isGuest } = useAuth();
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const guest = isGuest || !user;
  const name = guest ? "Guest" : (user.email?.split("@")[0] ?? "Account");
  const initials = guest ? "IN" : initialsFromEmail(user.email);

  return (
    <div className={`content-topbar ${className}`.trim()} suppressHydrationWarning>
      {children}
      <span className="topbar-date" suppressHydrationWarning>
        {today}
      </span>
      <Link
        className="topbar-account"
        href="/settings"
        aria-label={guest ? "Guest — open account settings" : `Signed in as ${user.email ?? name}`}
      >
        <span className="topbar-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="topbar-account-name">{name}</span>
      </Link>
    </div>
  );
}

export function BackToPractice() {
  return (
    <Link className="back-home" href="/practice">
      <ArrowLeft size={15} /> Back to Practice
    </Link>
  );
}
