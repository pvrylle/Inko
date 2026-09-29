import "server-only";

export type StudySource = {
  title: string;
  url: string;
  snippet: string;
};

const USER_AGENT = "InkoStudy/0.1 (educational study companion)";

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function publicStudyUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
    if (host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function unwrapSearchHref(href: string) {
  const cleaned = decodeHtml(href.trim());
  const absolute = cleaned.startsWith("//") ? `https:${cleaned}` : cleaned;
  try {
    const url = new URL(absolute);
    const wrapped = url.searchParams.get("uddg");
    if (wrapped) return publicStudyUrl(wrapped);
    return publicStudyUrl(absolute);
  } catch {
    return null;
  }
}

export function parseDuckDuckGoResults(html: string) {
  const titles = new Map<string, string>();
  const sources: StudySource[] = [];
  const seen = new Set<string>();
  const pattern = /<a\b[^>]*class="[^"]*\b(result__a|result__snippet)\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const kind = match[1]?.toLowerCase();
    const url = unwrapSearchHref(match[2] ?? "");
    const text = stripTags(match[3] ?? "");
    if (!url || !text || !kind) continue;
    if (kind === "result__a") {
      if (!titles.has(url)) titles.set(url, text.slice(0, 160));
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: text.slice(0, 160), url, snippet: text.slice(0, 320) });
    if (sources.length >= 4) break;
  }
  return sources.map((source) => ({ ...source, title: titles.get(source.url) ?? source.title }));
}

async function searchDuckDuckGo(query: string, timeoutMs: number) {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) return [];
  return parseDuckDuckGoResults(await response.text());
}

async function searchWikipedia(query: string, timeoutMs: number) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "4",
    prop: "extracts|info",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    exchars: "500",
    format: "json",
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    query?: { pages?: Record<string, { title?: string; extract?: string; fullurl?: string; index?: number }> };
  };
  const pages = Object.values(payload.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const sources: StudySource[] = [];
  for (const page of pages) {
    const url = page.fullurl ? publicStudyUrl(page.fullurl) : null;
    const title = page.title?.trim();
    const snippet = page.extract?.replace(/\s+/g, " ").trim();
    if (!url || !title || !snippet || /may refer to:/i.test(snippet)) continue;
    sources.push({ title: title.slice(0, 160), url, snippet: snippet.slice(0, 500) });
    if (sources.length >= 4) break;
  }
  return sources;
}

/** Real pages for a study question. Web results first, encyclopedia pages if search is empty. */
export async function searchStudySources(question: string, timeoutMs = 6_000) {
  const query = question.replace(/\s+/g, " ").trim().slice(0, 180);
  if (query.length < 2) return [];
  try {
    const web = await searchDuckDuckGo(query, timeoutMs);
    if (web.length > 0) return web;
  } catch {
    // The search page can be unavailable. The encyclopedia lookup below still grounds the answer.
  }
  try {
    return await searchWikipedia(query, timeoutMs);
  } catch {
    return [];
  }
}
