import { z } from "zod";

// ─── Accepted file types ──────────────────────────────────────────────────────

export const ACCEPTED_FILE_TYPES = [".pdf", ".doc", ".docx", ".txt", ".md"] as const;
export type AcceptedFileType = (typeof ACCEPTED_FILE_TYPES)[number];

/** Comma-separated accept string for use in <input accept="..."> (Requirement 9.1). */
export const ACCEPTED_FILE_TYPES_INPUT = ACCEPTED_FILE_TYPES.join(",");

// ─── Domain types ─────────────────────────────────────────────────────────────

/** A user-defined subject group used to organise files (e.g. "Biology 101"). */
export type LibraryClass = {
  id: string;
  owner_id: string;
  name: string;      // 1–80 characters
  created_at: string;
};

/** An uploaded academic file associated with a LibraryClass. */
export type LibraryFile = {
  id: string;
  owner_id: string;
  class_id: string;
  name: string;
  type: string;      // "pdf" | "doc" | "docx" | "txt" | "md"
  size_bytes: number;
  storage_path: string;
  upload_date: string;
  created_at: string;
};

// ─── Validation schemas ───────────────────────────────────────────────────────

/** Class name must be between 1 and 80 characters (Requirement 9.4). */
export const classNameSchema = z.string().min(1).max(80);
