import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createInitialFsrsState } from "@/features/flashcards/fsrs";
import { getRequestUser } from "@/lib/auth/request-user";
import type { Flashcard, Note } from "@/lib/data/models";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  cards: z.array(z.object({
    front: z.string().trim().min(1).max(1_000),
    back: z.string().trim().min(1).max(4_000),
  })).min(1).max(40),
});

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (!checkRateLimit(`flashcard-manual:${user.userId}`, 20, 60_000).allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "INVALID_FLASHCARD_DECK" }, { status: 400 });

  const now = new Date();
  const timestamp = now.toISOString();
  const title = body.data.title;
  const markdown = `# ${title}\n\n${body.data.cards.map((card, index) => `${index + 1}. ${card.front}\n${card.back}`).join("\n\n")}`;
  let note: Note = {
    id: crypto.randomUUID(),
    owner_id: user.userId,
    title,
    summary: `${body.data.cards.length} card${body.data.cards.length === 1 ? "" : "s"}`,
    content_markdown: markdown,
    source: "text",
    storage_path: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const initialFsrs = createInitialFsrsState(now);
  let cards: Flashcard[] = body.data.cards.map((card) => ({
    id: crypto.randomUUID(),
    owner_id: user.userId,
    note_id: note.id,
    front: card.front,
    back: card.back,
    explanation: null,
    ...initialFsrs,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  try {
    const supabase = user.isDemo ? null : await createServerSupabaseClient();
    let persisted = false;
    if (supabase) {
      const { data: savedNote, error: noteError } = await supabase.from("notes").insert(note).select("*").single();
      if (noteError || !savedNote) throw new Error("NOTE_SAVE_FAILED");
      note = savedNote as Note;
      cards = cards.map((card) => ({ ...card, note_id: note.id }));
      const { data: savedCards, error: cardError } = await supabase.from("flashcards").insert(cards).select("*");
      if (cardError || !savedCards) throw new Error("FLASHCARD_SAVE_FAILED");
      cards = savedCards as Flashcard[];
      persisted = true;
    }
    return NextResponse.json({ note, cards, persisted });
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "FLASHCARD_SAVE_FAILED";
    return NextResponse.json({ error }, { status: 502 });
  }
}
