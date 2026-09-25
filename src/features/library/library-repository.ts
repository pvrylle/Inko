"use client";

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
 * Derives the extension-based type label stored in the `library_files` row.
 * Falls back to the raw MIME type when the extension is unrecognised.
 */
function resolveFileType(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const knownExtensions: Record<string, string> = {
    pdf: "pdf",
    doc: "doc",
    docx: "docx",
    txt: "txt",
    md: "md",
  };
  return knownExtensions[ext] ?? file.type;
}

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
  if (!supabase) return [];

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("library_classes" as any)
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as LibraryClass[];
}

/**
 * Creates a new class for `userId`.
 * Validates `name` against the 1–80 character schema (Req 9.4) before inserting.
 */
export async function createClass(userId: string, name: string): Promise<LibraryClass> {
  classNameSchema.parse(name.trim());

  const supabase = getBrowserSupabaseClient();
  if (!supabase) throw new Error("Supabase client unavailable");

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("library_classes" as any)
    .insert({ owner_id: userId, name: name.trim() })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as LibraryClass;
}

/**
 * Deletes a class by ID, scoped to `userId`.
 * Associated files should be removed separately before calling this.
 */
export async function deleteClass(userId: string, classId: string): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) throw new Error("Supabase client unavailable");

  const { error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("library_classes" as any)
    .delete()
    .eq("id", classId)
    .eq("owner_id", userId);

  if (error) throw error;
}

// ─── Files ────────────────────────────────────────────────────────────────────

/**
 * Returns all files owned by `userId` across all classes, ordered by upload
 * date descending (most recently uploaded first).
 */
export async function listFiles(userId: string): Promise<LibraryFile[]> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("library_files" as any)
    .select("*")
    .eq("owner_id", userId)
    .order("upload_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as LibraryFile[];
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
  userId: string,
  classId: string,
  file: File,
): Promise<LibraryFile> {
  // MIME / extension guard (Req 9.1)
  if (!isAcceptedFile(file)) {
    throw new Error(
      `Unsupported file type for "${file.name}". Accepted types: .pdf, .doc, .docx, .txt, .md.`,
    );
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) throw new Error("Supabase client unavailable");

  // Generate a stable file ID to use as part of the storage path
  const fileId = crypto.randomUUID();
  const storagePath = `${userId}/${classId}/${fileId}/${file.name}`;

  // Upload to storage (Req 9.2)
  const { error: storageError } = await supabase.storage
    .from("library-files")
    .upload(storagePath, file, { upsert: false });

  if (storageError) {
    throw new Error(
      `Failed to upload "${file.name}": ${storageError.message}`,
    );
  }

  const now = new Date().toISOString();

  // Insert the metadata row (Req 9.2)
  const { data, error: dbError } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("library_files" as any)
    .insert({
      id: fileId,
      owner_id: userId,
      class_id: classId,
      name: file.name,
      type: resolveFileType(file),
      size_bytes: file.size,
      storage_path: storagePath,
      upload_date: now,
    })
    .select()
    .single();

  if (dbError) {
    // Best-effort cleanup: remove the orphaned storage object
    await supabase.storage.from("library-files").remove([storagePath]);
    throw new Error(`Failed to upload "${file.name}": ${dbError.message}`);
  }

  return data as unknown as LibraryFile;
}

/**
 * Deletes a file from Supabase Storage and removes its `library_files` row.
 * Both operations are scoped to `userId` (Req 9.9).
 */
export async function deleteFile(userId: string, file: LibraryFile): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) throw new Error("Supabase client unavailable");

  // Remove from storage first
  const { error: storageError } = await supabase.storage
    .from("library-files")
    .remove([file.storage_path]);

  // Log but don't block on storage errors — the row deletion is authoritative
  if (storageError) {
    console.warn(`library-repository: storage removal warning for "${file.name}":`, storageError.message);
  }

  // Delete the metadata row, scoped to owner for safety (Req 9.9)
  const { error: dbError } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("library_files" as any)
    .delete()
    .eq("id", file.id)
    .eq("owner_id", userId);

  if (dbError) throw new Error(`Failed to delete "${file.name}": ${dbError.message}`);
}
