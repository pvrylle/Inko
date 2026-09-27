"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { InkoMascot } from "@/features/mascot/inko-mascot";
import { initialMascotState } from "@/features/mascot/mascot-state";
import { AuthForm } from "./auth-form";
import type { AuthMode } from "./auth-modal-provider";

export function AuthModal({
  open,
  mode,
  ticket,
  onClose,
}: {
  open: boolean;
  mode: AuthMode;
  ticket: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [activeMode, setActiveMode] = useState<AuthMode>(mode);

  useEffect(() => {
    if (open) setActiveMode(mode);
  }, [open, mode, ticket]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && user) onClose();
  }, [open, user, onClose]);

  if (!open) return null;

  const signingUp = activeMode === "signup";

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <div className="auth-modal-hero" aria-hidden="true">
          <InkoMascot character="octopus" state={initialMascotState} className="auth-modal-mascot" fit="contain" />
        </div>
        <div className="auth-modal-body">
          <h2 id="auth-modal-title">{signingUp ? "Create your free account" : "Welcome back"}</h2>
          <p>{signingUp ? "Save your research and unlock live voice." : "Sign in and pick up your study session."}</p>
          <AuthForm key={ticket} initialMode={mode} onModeChange={setActiveMode} hideGuestHint />
        </div>
      </div>
    </div>
  );
}
