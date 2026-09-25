"use client";

import { BookOpenCheck, FileStack, FolderOpen, Plus } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { classNameSchema } from "./library-schema";
import { ClassGroup } from "./class-group";
import { FileUploadZone } from "./file-upload-zone";
import { useLibrary } from "./use-library";

type NewClassFormProps = {
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
};

function NewClassForm({ onSubmit, onCancel }: NewClassFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!classNameSchema.safeParse(trimmed).success) {
      setError("Class name must be between 1 and 80 characters.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try { await onSubmit(trimmed); }
    finally { setSubmitting(false); }
  };

  return (
    <form className="new-class-form" onSubmit={handleSubmit}>
      <label htmlFor="new-class-name">Name your class or subject</label>
      <div className="new-class-field">
        <input autoFocus className="new-class-input" disabled={submitting} id="new-class-name" maxLength={80} onChange={(event) => { setName(event.target.value); setError(null); }} placeholder="e.g. Biology 101" type="text" value={name} />
        <button className="primary-button new-class-submit" disabled={submitting || !name.trim()} type="submit">{submitting ? "Creating…" : "Create class"}</button>
        <button className="secondary-button" disabled={submitting} onClick={onCancel} type="button">Cancel</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

export function LibraryView() {
  const { classes, files, createClass, uploadFile, deleteFile, loading, error, uploadError } = useLibrary();
  const [showNewClassForm, setShowNewClassForm] = useState(false);

  const filesByClass = new Map<string, typeof files>(classes.map((item) => [item.id, []]));
  for (const file of files) filesByClass.get(file.class_id)?.push(file);

  const createAndClose = async (name: string) => {
    await createClass(name);
    setShowNewClassForm(false);
  };

  return (
    <div className="library-page content-page page-enter">
      <header className="library-hero">
        <div>
          <p className="eyebrow"><BookOpenCheck size={14} /> Your learning materials</p>
          <h1>Library</h1>
          <p>Keep every handout, reading, and study note organised by class so Inko can help you build on it.</p>
        </div>
        <div className="library-stats" aria-label="Library summary">
          <span><strong>{classes.length}</strong><small>classes</small></span>
          <span><strong>{files.length}</strong><small>files</small></span>
        </div>
      </header>

      <section className="library-workbench" aria-label="Library controls">
        <div className="library-workbench-copy">
          <span className="library-workbench-icon"><FileStack size={20} /></span>
          <div><strong>Build your study sourcebook</strong><small>PDF, DOC, DOCX, TXT, and Markdown are supported.</small></div>
        </div>
        <div className="library-toolbar">
          {showNewClassForm ? (
            <NewClassForm onSubmit={createAndClose} onCancel={() => setShowNewClassForm(false)} />
          ) : (
            <button className="secondary-button" onClick={() => setShowNewClassForm(true)} type="button"><Plus size={15} /> New class</button>
          )}
          <FileUploadZone classes={classes} uploadFile={uploadFile} uploadError={uploadError} onCreate={() => setShowNewClassForm(true)} />
        </div>
      </section>

      {error && <p className="form-error library-error" role="alert">{error}</p>}

      {loading ? (
        <div className="library-loading" aria-live="polite" aria-busy="true">
          <span /><span /><span />
          <p>Opening your library…</p>
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Create a home for your first file"
          message="Add a class or subject, then upload a reading, handout, or set of notes to get started."
          action={<button className="primary-button" onClick={() => setShowNewClassForm(true)} type="button"><Plus size={16} /> Create your first class</button>}
        />
      ) : (
        <section className="library-collections" aria-labelledby="library-collections-title">
          <div className="section-title-row"><div><p className="eyebrow">Collections</p><h2 id="library-collections-title">Organised by class</h2></div><p>{files.length ? `${files.length} materials ready to study` : "Your classes are ready for files"}</p></div>
          <div className="library-class-list">
            {classes.map((libraryClass) => (
              <ClassGroup key={libraryClass.id} libraryClass={libraryClass} files={filesByClass.get(libraryClass.id) ?? []} onDeleteFile={(file) => void deleteFile(file)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
