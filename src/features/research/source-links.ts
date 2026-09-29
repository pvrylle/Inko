export type SourceLink = { label: string; href: string };

/** Only http(s) URLs are opened from source cards. */
export function openableUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Direct source URL when present, plus Wikipedia and Scholar lookups for the title. */
export function sourceQuickLinks(source: { title: string; url: string | null }): SourceLink[] {
  const query = source.title.trim().slice(0, 180);
  const links: SourceLink[] = [];
  const open = openableUrl(source.url);
  if (open) links.push({ label: "Open", href: open });
  if (!query) return links;
  links.push({
    label: "Wikipedia",
    href: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
  });
  links.push({
    label: "Scholar",
    href: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
  });
  return links;
}
