const LEAD_IN = /^(?:hey(?:\s+inko)?[,!]?\s+|please\s+|can you\s+|could you\s+|would you\s+|will you\s+)?(?:please\s+)?(?:search(?:\s+(?:about|for|up))?\s+|look(?:\s+up)?\s+|find(?:\s+out(?:\s+about)?)?\s+|tell me (?:about\s+|more about\s+)?|explain(?:\s+to me)?\s+|what(?:'s| is| are)\s+|how(?:\s+does|\s+do|\s+can|\s+to)?\s+|help me (?:with\s+|understand\s+|learn\s+|plan\s+)?|i (?:want|need) to (?:know|learn|understand)\s+)?/i;

export function deriveConversationTitle(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  let body = cleaned.replace(LEAD_IN, "").replace(/^[^\p{L}\p{N}]+/u, "").replace(/[?!.]+$/g, "").trim();
  if (body.length < 3) body = cleaned.replace(/[?!.]+$/g, "").trim();
  const clipped = body.length > 48 ? `${body.slice(0, 45).replace(/\s+\S*$/, "").trim()}…` : body;
  if (!clipped) return "New chat";
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

export function isDefaultConversationTitle(title: string, firstStudentText?: string) {
  const trimmed = title.trim();
  if (!trimmed || /^new (chat|conversation)$/i.test(trimmed)) return true;
  if (!firstStudentText) return false;
  const raw = firstStudentText.replace(/\s+/g, " ").trim().slice(0, 80);
  return trimmed === raw || trimmed === raw.replace(/[?!.]+$/g, "");
}

export function conversationTitleFromMessages(title: string, messages: Array<{ role: string; text: string }>) {
  const first = messages.find((message) => message.role === "student")?.text;
  if (!first || !isDefaultConversationTitle(title, first)) return title.trim().slice(0, 160) || "New chat";
  return deriveConversationTitle(first);
}
