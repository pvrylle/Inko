"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useId, useState } from "react";

export function StudentMessageEdit({
  text,
  busy,
  onCancel,
  onSave,
}: {
  text: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (text: string) => void;
}) {
  const [draft, setDraft] = useState(text);
  const fieldId = useId();

  useEffect(() => {
    setDraft(text);
  }, [text]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draft.trim();
    if (!next || busy) return;
    onSave(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form className="student-message-edit" onSubmit={submit}>
      <label className="sr-only" htmlFor={fieldId}>Edit your message</label>
      <textarea autoFocus id={fieldId} maxLength={4000} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} rows={4} value={draft} />
      <div className="student-message-edit-actions">
        <button className="secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="primary-button" disabled={!draft.trim() || busy} type="submit">Save</button>
      </div>
    </form>
  );
}
