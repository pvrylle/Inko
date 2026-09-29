"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_LENGTH = 120;

export function SessionNameForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Please give your session a name.");
      return;
    }
    setError(null);
    setCommitted(name.trim());
    // Persisted to sessionStorage — ephemeral context for Inko, clears on tab close
    sessionStorage.setItem("inko:session-name", name.trim());
    router.push("/flashcards");
  };

  return (
    <div className="session-name-wrap">
      {committed ? (
        <p className="session-name-active">
          <span>Session:</span> <strong>{committed}</strong>
        </p>
      ) : (
        <form className="session-name-form" onSubmit={handleSubmit}>
          <label className="session-name-label" htmlFor="session-name">
            Name this session
          </label>
          <div className="session-name-field">
            <input
              id="session-name"
              maxLength={MAX_LENGTH}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Biology 101 – Cell division"
              type="text"
              value={name}
            />
            <button className="session-name-submit" type="submit">
              Start
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
