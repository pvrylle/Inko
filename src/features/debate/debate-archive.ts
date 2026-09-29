export type SavedDebateTurn = { role: "student" | "inko"; text: string };

export type SavedDebate = {
  id: string;
  claim: string;
  mode: "debate" | "socratic" | "defense";
  researchSessionId: string | null;
  researchQuestion: string;
  chatSessionId: string | null;
  chatTitle: string;
  turns: SavedDebateTurn[];
  createdAt: string;
  updatedAt: string;
};

const PREFIX = "inko.debates.";

export function upsertDebate(list: SavedDebate[], debate: SavedDebate): SavedDebate[] {
  return [debate, ...list.filter((item) => item.id !== debate.id)].slice(0, 40);
}

function storageKey(userId: string) {
  return `${PREFIX}${userId}`;
}

export function listDebates(userId: string): SavedDebate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as SavedDebate[]) : [];
    return parsed.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  } catch {
    return [];
  }
}

export function getDebate(userId: string, id: string): SavedDebate | null {
  return listDebates(userId).find((item) => item.id === id) ?? null;
}

export function saveDebate(userId: string, debate: SavedDebate) {
  if (typeof window === "undefined") return;
  const next = upsertDebate(listDebates(userId), debate);
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
}
