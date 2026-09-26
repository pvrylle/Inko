"use client";

import { inkoFetch } from "@/lib/auth/api-client";
import { readDemo, removeDemo, saveDemo } from "@/lib/data/demo-memory";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { classNameSchema, type LibraryClass, type LibraryFile } from "./library-schema";

// ─── MIME type guard ──────────────────────────────────────────────────────────

/**
 * Maps accepted file extensions to their MIME types (and common variants).
 * Used to validate the File.type before touching Supabase Storage (Req 9.1).
 */
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",                                                    // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",                                                            // .txt
  "text/markdown",                                                         // .md
  "text/x-markdown",                                                       // .md (alternate)
]);

/**
 * Returns `true` when the file's MIME type or extension is in the accepted set.
 * The extension check provides a safety net for browsers that report an empty
 * `file.type` for .md files.
 */
function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["pdf", "doc", "docx", "txt", "md"].includes(ext);
}

// ─── Classes ──────────────────────────────────────────────────────────────────

/**
 * Returns all classes owned by `userId`, ordered by creation date ascending.
 */
export async function listClasses(userId: string): Promise<LibraryClass[]> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return readDemo<LibraryClass>("library-classes", userId);

  const { data, error } = await supabase
    .from("library_classes")
    .select("id, owner_id, name, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Creates a new class for `userId`.
 * Validates `name` against the 1–80 character schema (Req 9.4) before inserting.
 */
export async function createClass(userId: string, name: string): Promise<LibraryClass> {
  classNameSchema.parse(name.trim());
  const response = await inkoFetch("/api/library/classes", {
    method: "POST",
    body: JSON.stringify({ name: name.trim() }),
  });
  if (!response.ok) throw new Error("Failed to create class.");
  const created = (await response.json()) as LibraryClass;
  if (!getBrowserSupabaseClient()) saveDemo("library-classes", userId, created);
  return created;
}

/**
 * Deletes a class by ID, scoped to `userId`.
 * Associated files should be removed separately before calling this.
 */
export async function deleteClass(userId: string, classId: string): Promise<void> {
  const response = await inkoFetch(`/api/library/classes/${classId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete class.");
  if (!getBrowserSupabaseClient()) removeDemo("library-classes", userId, classId);
}

// ─── Files ────────────────────────────────────────────────────────────────────

/**
 * Returns all files owned by `userId` across all classes, ordered by upload
 * date descending (most recently uploaded first).
 */
export async function listFiles(userId: string): Promise<LibraryFile[]> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return readDemo<LibraryFile>("library-files", userId);

  const { data, error } = await supabase
    .from("library_files")
    .select("id, owner_id, class_id, name, type, size_bytes, storage_path, upload_date, created_at")
    .eq("owner_id", userId)
    .order("upload_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Uploads a file to Supabase Storage and inserts a `library_files` row.
 *
 * Storage path: `{owner_id}/{class_id}/{file_id}/{filename}`
 * Bucket:       `library-files`
 *
 * Throws an error with a descriptive message if:
 * - The file type is not in the accepted set (Req 9.1)
 * - The storage upload fails (Req 9.5)
 * - The database insert fails (Req 9.5)
 */
export async function uploadFile(
  _userId: string,
  classId: string,
  file: File,
): Promise<LibraryFile> {
  // MIME / extension guard (Req 9.1)
  if (!isAcceptedFile(file)) {
    throw new Error(
      `Unsupported file type for "${file.name}". Accepted types: .pdf, .doc, .docx, .txt, .md.`,
    );
  }

  const body = new FormData();
  body.set("classId", classId);
  body.set("file", file);
  const response = await inkoFetch("/api/library/files", { method: "POST", body });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`Failed to upload "${file.name}": ${payload?.error ?? "UPLOAD_FAILED"}`);
  }
  return (await response.json()) as LibraryFile;
}

/**
 * Deletes a file from Supabase Storage and removes its `library_files` row.
 * Both operations are scoped to `userId` (Req 9.9).
 */
export async function deleteFile(userId: string, file: LibraryFile): Promise<void> {
  const response = await inkoFetch(`/api/library/files/${file.id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Failed to delete "${file.name}".`);
  if (!getBrowserSupabaseClient()) removeDemo("library-files", userId, file.id);
}
