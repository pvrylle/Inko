"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthModal } from "./auth-modal";

export type AuthMode = "signin" | "signup";

type AuthModalContextValue = {
  openAuth: (mode?: AuthMode) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signup");
  const [ticket, setTicket] = useState(0);

  const openAuth = useCallback((next: AuthMode = "signup") => {
    setMode(next);
    setTicket((current) => current + 1);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openAuth }), [openAuth]);

  useEffect(() => {
    const onGuestLimit = () => openAuth("signup");
    window.addEventListener("inko:guest-limit", onGuestLimit);
    return () => window.removeEventListener("inko:guest-limit", onGuestLimit);
  }, [openAuth]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal open={open} mode={mode} ticket={ticket} onClose={close} />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return context;
}
