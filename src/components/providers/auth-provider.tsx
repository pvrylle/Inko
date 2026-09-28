"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const DEMO_USER_KEY = "inko.demo-user-id";
const AUTH_STARTUP_TIMEOUT_MS = 2500;

async function getInitialUser(supabase: NonNullable<ReturnType<typeof getBrowserSupabaseClient>>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      supabase.auth.getSession().then(({ data }) => data.session?.user ?? null).catch(() => null),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), AUTH_STARTUP_TIMEOUT_MS); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type AuthState = {
  user: User | null;
  userId: string | null;
  isReady: boolean;
  isDemo: boolean;
  isGuest: boolean;
  error: string | null;
};

type AuthContextValue = AuthState & {
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userId: null,
  isReady: false,
  isDemo: false,
  isGuest: false,
  error: null,
  signOut: async () => {},
});

function getDemoUserId() {
  const existing = window.localStorage.getItem(DEMO_USER_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(DEMO_USER_KEY, created);
  return created;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    userId: null,
    isReady: false,
    isDemo: false,
    isGuest: false,
    error: null,
  });

  const signOut = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.localStorage.removeItem(DEMO_USER_KEY);
    const guestId = getDemoUserId();
    setState({ user: null, userId: guestId, isReady: true, isDemo: false, isGuest: true, error: null });
    router.push("/");
    router.refresh();
  }, [router]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      const demoUserId = getDemoUserId();
      queueMicrotask(() =>
        setState({ user: null, userId: demoUserId, isReady: true, isDemo: true, isGuest: true, error: null }),
      );
      return;
    }

    let active = true;
    const establishSession = async () => {
      const initialUser = await getInitialUser(supabase);
      if (initialUser) {
        if (active)
          setState({
            user: initialUser,
            userId: initialUser.id,
            isReady: true,
            isDemo: false,
            isGuest: false,
            error: null,
          });
        return;
      }

      // No anonymous auto-sign-in anymore: new users are guests until they choose to sign up.
      const demoUserId = getDemoUserId();
      if (active)
        setState({
          user: null,
          userId: demoUserId,
          isReady: true,
          isDemo: false,
          isGuest: true,
          error: null,
        });
    };

    void establishSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState((current) => ({
        ...current,
        user: session?.user ?? null,
        userId: session?.user.id ?? getDemoUserId(),
        isGuest: !session?.user,
        isReady: true,
      }));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ ...state, signOut }), [state, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
