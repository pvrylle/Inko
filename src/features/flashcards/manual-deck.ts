export type DraftCard = { id: string; front: string; back: string };

export function emptyDraftCard(): DraftCard {
  return { id: crypto.randomUUID(), front: "", back: "" };
}

export function starterDraftCards(): DraftCard[] {
  return [emptyDraftCard(), emptyDraftCard(), emptyDraftCard()];
}

export function filledDraftCards(cards: DraftCard[]): Array<{ front: string; back: string }> {
  return cards.flatMap((card) => {
    const front = card.front.trim().slice(0, 1000);
    const back = card.back.trim().slice(0, 4000);
    return front && back ? [{ front, back }] : [];
  });
}

export function deckNoteMarkdown(title: string, cards: Array<{ front: string; back: string }>) {
  const heading = title.trim().slice(0, 160) || "Flashcards";
  const body = cards.map((card, index) => `${index + 1}. ${card.front}\n${card.back}`).join("\n\n");
  return `# ${heading}\n\n${body}`;
}
