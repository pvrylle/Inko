"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, BookOpen, Mic } from "lucide-react";
import Link from "next/link";
import { useNotes } from "@/features/notes/use-notes";

const spring = { type: "spring" as const, stiffness: 240, damping: 24 };

export function RecentNotesStrip() {
  const { notes, loading } = useNotes();
  const reduced = useReducedMotion();
  const recent = notes.slice(0, 4);

  if (loading || recent.length === 0) return null;

  return (
    <section className="recent-notes" aria-label="Recent notes">
      <div className="section-title-row">
        <div>
          <p className="eyebrow"><BookOpen size={13} /> From your library</p>
          <h2>Recent captures</h2>
        </div>
        <Link className="section-link" href="/library">Open library <ArrowUpRight size={14} /></Link>
      </div>
      <div className="recent-notes-list">
        {recent.map((note, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
            key={note.id}
            transition={{ delay: 0.05 + index * 0.06, ...spring }}
            whileHover={reduced ? undefined : { y: -3 }}
          >
            <Link className="recent-note" href="/library">
              <span className="recent-note-badge" data-source={note.source}>
                {note.source === "voice" ? <Mic size={11} /> : <BookOpen size={11} />}
                {note.source === "voice" ? "Voice" : "Note"}
              </span>
              <h3>{note.title}</h3>
              <p>{note.summary}</p>
              <small>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(note.created_at))}</small>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
