"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const DEMO_USER_KEY = "inko.demo-user-id";

type AuthState = {
  user: User | null;
  userId: string | null;
  isReady: boolean;
  isDemo: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthState>({
  user: null,
  userId: null,
  isReady: false,
  isDemo: false,
  error: null,
});

function getDemoUserId() {
  const existing = window.localStorage.getItem(DEMO_USER_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(DEMO_USER_KEY, created);
  return created;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, userId: null, isReady: false, isDemo: false, error: null });

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      const demoUserId = getDemoUserId();
      queueMicrotask(() => setState({ user: null, userId: demoUserId, isReady: true, isDemo: true, error: null }));
      return;
    }

    let active = true;
    const establishSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (active) setState({ user: session.user, userId: session.user.id, isReady: true, isDemo: false, error: null });
        return;
      }

      const { data, error } = await supabase.auth.signInAnonymously();
      if (!active) return;
      setState({
        user: data.user,
        userId: data.user?.id ?? null,
        isReady: true,
        isDemo: false,
        error: error ? "Inko couldn't start a private guest session." : null,
      });
    };

    void establishSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState((current) => ({ ...current, user: session?.user ?? null, userId: session?.user.id ?? null, isReady: true }));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
