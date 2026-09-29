/** Marks the end of a streamed chat answer. The JSON sources object follows it. */
export const chatSourceTrailer = "\n\n\u0000INKO";

/** Sentences ready to speak, plus the exact unsent suffix of `text`. */
export function pullSpeakable(text: string, force: boolean) {
  const speak: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const slice = text.slice(cursor);
    const match = /[.!?](?=\s|$)/.exec(slice);
    if (match && match.index >= 0) {
      const sentence = slice.slice(0, match.index + 1).trim();
      cursor += match.index + 1;
      while (text[cursor] === " ") cursor += 1;
      if (sentence) speak.push(sentence);
      continue;
    }
    if (slice.trim().length >= 80) {
      const cut = slice.lastIndexOf(" ", 80);
      const end = cut > 24 ? cut : 80;
      const sentence = slice.slice(0, end).trim();
      cursor += end;
      while (text[cursor] === " ") cursor += 1;
      if (sentence) speak.push(sentence);
      continue;
    }
    if (force && slice.trim()) {
      speak.push(slice.trim());
      cursor = text.length;
      continue;
    }
    break;
  }
  return { speak, rest: text.slice(cursor) };
}
