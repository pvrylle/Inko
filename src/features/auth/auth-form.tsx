"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";

export function AuthForm({
  initialMode = "signup",
  onModeChange,
  hideGuestHint = false,
}: {
  initialMode?: "signin" | "signup";
  onModeChange?: (mode: "signin" | "signup") => void;
  hideGuestHint?: boolean;
}) {
  const router = useRouter();
  const { isGuest, user, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const supabase = getBrowserSupabaseClient();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setStatus("error");
      setMessage("Supabase is not configured in this environment.");
      return;
    }
    setStatus("loading");
    setMessage("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("success");
        setMessage("Check your email for the confirmation link.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    }
  };

  if (user) {
    return (
      <div className="auth-form">
        <p className="auth-form-success">You’re signed in.</p>
        <button type="button" className="auth-form-submit" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-form-tabs">
        <button
          type="button"
          className="auth-form-tab"
          data-active={mode === "signup"}
          onClick={() => {
            setMode("signup");
            onModeChange?.("signup");
          }}
        >
          Create account
        </button>
        <button
          type="button"
          className="auth-form-tab"
          data-active={mode === "signin"}
          onClick={() => {
            setMode("signin");
            onModeChange?.("signin");
          }}
        >
          Sign in
        </button>
      </div>

      {isGuest && !hideGuestHint && (
        <p className="auth-form-hint">
          Creating an account keeps your local notes, flashcards, and progress safe.
        </p>
      )}

      <label className="auth-form-field">
        <span>Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.edu"
        />
      </label>

      <label className="auth-form-field">
        <span>Password</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </label>

      {message && <p className={`auth-form-message ${status}`}>{message}</p>}

      <button type="submit" className="auth-form-submit" disabled={status === "loading"}>
        {status === "loading" ? "Working…" : mode === "signup" ? "Create free account" : "Sign in"}
      </button>

      {!supabase && (
        <p className="auth-form-message error">
          Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable sign-up.
        </p>
      )}
    </form>
  );
}
