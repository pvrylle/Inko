"use client";

import { inkoFetch } from "@/lib/auth/api-client";
import type { Note } from "@/lib/data/models";
import { deleteLocalRecord, readLocalCollection, subscribeToLocalCollection, upsertLocalRecord } from "@/lib/data/local-store";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export async function generateNoteFromContent(userId: string, content: string) {
  const response = await inkoFetch("/api/study/notes/generate", { method: "POST", body: JSON.stringify({ content, source: "text", callId: crypto.randomUUID() }) });
  const payload = (await response.json()) as { note?: Note; persisted?: boolean; error?: string };
  if (!response.ok || !payload.note) throw new Error(payload.error || "NOTE_GENERATION_FAILED");
  if (!payload.persisted) upsertLocalRecord("notes", userId, payload.note);
  return payload.note;
}

export async function listNotes(userId: string) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return readLocalCollection<Note>("notes", userId);
  const { data, error } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Note[];
}

export async function removeNote(userId: string, note: Note) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return deleteLocalRecord<Note>("notes", userId, note.id);
  if (note.storage_path) await supabase.storage.from("note-assets").remove([note.storage_path]);
  const { error } = await supabase.from("notes").delete().eq("id", note.id);
  if (error) throw error;
}

export function subscribeToNotes(userId: string, onChange: () => void) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return subscribeToLocalCollection("notes", userId, onChange);
  const channel = supabase
    .channel(`notes:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `owner_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function downloadNote(note: Note) {
  const blob = new Blob([note.content_markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${note.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "inko-note"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
