import { z } from "zod";

// ─── Tag ──────────────────────────────────────────────────────────────────────

export type SourceTag = "supports" | "contradicts" | "untagged";

// ─── Domain types ─────────────────────────────────────────────────────────────

export type ResearchSession = {
  id: string;
  owner_id: string;
  question: string;
  created_at: string;
  updated_at: string;
  /** Optional short project title (falls back to a derived title). */
  title?: string | null;
  /** Optional project description shown under the title. */
  description?: string | null;
  status?: "draft" | "analyzing" | "ready" | "failed";
};

export type ResearchSource = {
  id: string;
  session_id: string;
  owner_id: string;
  title: string;
  url: string | null;
  type: "document" | "url" | "file";
  tag: SourceTag;
  created_at: string;
  /** Optional display meta, e.g. "PDF · 24 pages" or "Article · 12 min read". */
  meta?: string;
};

export type ResearchFinding = {
  id: string;
  session_id: string;
  owner_id: string;
  statement: string;
  source_id: string | null;
  created_at: string;
  /** Optional count of sources backing this finding (for display). */
  sourceCount?: number;
};

export type ResearchContradiction = {
  id: string;
  session_id: string;
  owner_id: string;
  explanation: string;
  source_ids: string[];  // references two or more ResearchSource ids
  created_at: string;
};

export type OpenQuestion = {
  id: string;
  session_id: string;
  owner_id: string;
  text: string;
  created_at: string;
};

export type ResearchNote = {
  id: string;
  session_id: string;
  owner_id: string;
  content_markdown: string;
  updated_at: string;
};

export type CanvasNote = {
  id: string;
  session_id: string;
  owner_id: string;
  content: string;
  updated_at: string;
};

// ─── Validation schemas ───────────────────────────────────────────────────────

/** Research question must be between 10 and 500 characters (Requirements 8.10, 8.12). */
export const researchQuestionSchema = z.string().min(10).max(500);
