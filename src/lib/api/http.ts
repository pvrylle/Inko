import { NextResponse } from "next/server";

export function apiError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export function mapDbError(error: { message?: string; code?: string } | null) {
  const message = error?.message ?? "";
  if (error?.code === "23505") {
    if (message.includes("library_classes_owner_name")) return "CLASS_EXISTS";
    if (message.includes("research_sources_session_file")) return "SOURCE_ALREADY_ATTACHED";
    return "CONFLICT";
  }
  if (message.includes("NOT_FOUND") || error?.code === "P0002") return "NOT_FOUND";
  if (message.includes("NO_SOURCES")) return "NO_SOURCES";
  if (message.includes("CLASS_NOT_OWNED")) return "CLASS_NOT_FOUND";
  if (message.includes("CLASS_FILE_QUOTA")) return "CLASS_FILE_QUOTA";
  if (message.includes("OWNER_FILE_QUOTA")) return "OWNER_FILE_QUOTA";
  if (message.includes("FILE_NOT_OWNED")) return "FILE_NOT_FOUND";
  if (message.includes("SESSION_NOT_OWNED")) return "NOT_FOUND";
  return "REQUEST_FAILED";
}
