import type { Note } from "@/lib/data/models";

export function topicToNote(userId: string, topic: string): Note {
  const now = new Date().toISOString();
  const title = topic.trim().slice(0, 80) || "Study topic";
  return {
    id: crypto.randomUUID(),
    owner_id: userId,
    title,
    summary: topic.trim(),
    content_markdown: `# ${title}\n\n${topic.trim()}`,
    source: "text",
    storage_path: null,
    created_at: now,
    updated_at: now,
  };
}
