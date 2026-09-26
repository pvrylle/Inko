export const MAX_LIBRARY_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES_PER_CLASS = 40;
export const MAX_FILES_PER_OWNER = 200;

const EXTENSIONS = ["pdf", "doc", "docx", "txt", "md"] as const;
export type LibraryFileType = (typeof EXTENSIONS)[number];

const MIME_BY_TYPE: Record<LibraryFileType, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/x-markdown", "text/plain"],
};

export function sanitizeFileName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 180 || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) return null;
  if (/[\u0000-\u001f]/.test(trimmed)) return null;
  return trimmed;
}

export function fileTypeFromName(name: string): LibraryFileType | null {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSIONS.includes(extension as LibraryFileType) ? (extension as LibraryFileType) : null;
}

export function assertUpload(file: { name: string; type: string; size: number }, header: Uint8Array) {
  const name = sanitizeFileName(file.name);
  if (!name) return { ok: false as const, error: "INVALID_FILE_NAME" };
  const type = fileTypeFromName(name);
  if (!type) return { ok: false as const, error: "UNSUPPORTED_FILE" };
  if (file.size < 1 || file.size > MAX_LIBRARY_FILE_BYTES) return { ok: false as const, error: "FILE_TOO_LARGE" };
  const mime = file.type.trim().toLowerCase();
  const allowed = MIME_BY_TYPE[type];
  if (mime && !allowed.includes(mime)) return { ok: false as const, error: "UNSUPPORTED_FILE" };
  if (type === "pdf") {
    const magic = String.fromCharCode(...header.subarray(0, 4));
    if (magic !== "%PDF") return { ok: false as const, error: "UNSUPPORTED_FILE" };
  }
  return { ok: true as const, name, type };
}
