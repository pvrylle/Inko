"use client";

import { BookOpen, Download, Mic, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import type { Note } from "@/lib/data/models";
import { MarkdownNote } from "./markdown-note";
import { downloadNote, generateNoteFromContent, removeNote } from "./notes-repository";
import { useNotes } from "./use-notes";

export function LibraryView() {
  const { notes, loading, error, reload, userId } = useNotes();
  const [search, setSearch] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [content, setContent] = useState("");
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Note | null>(null);

  const filtered = useMemo(() => notes.filter((note) => `${note.title} ${note.summary} ${note.content_markdown}`.toLowerCase().includes(search.toLowerCase())), [notes, search]);

  const createNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || !content.trim()) return;
    setWorking(true);
    setFormError(null);
    try {
      const note = await generateNoteFromContent(userId, content);
      setContent("");
      setCapturing(false);
      setSelected(note);
      await reload();
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "NOTE_GENERATION_FAILED";
      setFormError(code === "GEMINI_NOT_CONFIGURED" ? "Add GEMINI_API_KEY to structure notes with Inko." : "Inko couldn't shape that note. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const deleteNote = async (note: Note) => {
    if (!userId) return;
    await removeNote(userId, note);
    if (selected?.id === note.id) setSelected(null);
    await reload();
  };

  return (
    <div className="content-page page-enter">
      <PageHeading eyebrow="Your knowledge" title="Library" description="Every idea you capture with Inko, organized in one calm place." action={<button className="primary-button" onClick={() => setCapturing(true)}><Plus size={18} /> New note</button>} />

      {capturing && (
        <form className="capture-card" onSubmit={createNote}>
          <div className="capture-heading"><span><Sparkles size={18} /> Shape a smart note</span><button aria-label="Close note capture" onClick={() => setCapturing(false)} type="button"><X size={18} /></button></div>
          <label htmlFor="note-content">Paste a paragraph or write what you&apos;re learning</label>
          <textarea autoFocus id="note-content" onChange={(event) => setContent(event.target.value)} placeholder="Mitosis is the process where…" rows={7} value={content} />
          {formError && <p className="form-error">{formError}</p>}
          <div className="capture-actions"><small>Gemini will preserve your meaning and organize the ideas.</small><button className="primary-button" disabled={working || content.trim().length < 8}>{working ? "Thinking…" : "Create note"}</button></div>
        </form>
      )}

      <label className="search-field"><Search size={19} /><span className="sr-only">Search notes</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search your notes…" value={search} /></label>
      {error && <p className="form-error">{error}</p>}

      {!loading && notes.length === 0 ? (
        <EmptyState icon={BookOpen} title="Your first note starts with a thought" message="Talk naturally and Inko will shape your words into a clear, useful note." action={<button className="secondary-button" onClick={() => setCapturing(true)}><Mic size={18} /> Capture an idea</button>} />
      ) : (
        <div className="notes-grid" aria-busy={loading}>
          {filtered.map((note) => (
            <article className="note-card" key={note.id}>
              <button className="note-card-main" onClick={() => setSelected(note)}>
                <span className="note-source">{note.source === "voice" ? "Voice note" : "Study note"}</span>
                <h2>{note.title}</h2>
                <p>{note.summary}</p>
                <small>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(note.created_at))}</small>
              </button>
              <div className="note-card-actions"><button aria-label={`Download ${note.title}`} onClick={() => downloadNote(note)}><Download size={16} /></button><button aria-label={`Delete ${note.title}`} onClick={() => void deleteNote(note)}><Trash2 size={16} /></button></div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <div className="note-drawer-backdrop" onMouseDown={() => setSelected(null)}>
          <aside className="note-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label={selected.title}>
            <div className="drawer-actions"><button onClick={() => downloadNote(selected)}><Download size={17} /> Download .md</button><button aria-label="Close note" onClick={() => setSelected(null)}><X size={20} /></button></div>
            <MarkdownNote markdown={selected.content_markdown} />
          </aside>
        </div>
      )}
    </div>
  );
}
