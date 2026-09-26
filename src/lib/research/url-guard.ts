import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const BLOCK = new BlockList();
BLOCK.addSubnet("0.0.0.0", 8, "ipv4");
BLOCK.addSubnet("10.0.0.0", 8, "ipv4");
BLOCK.addSubnet("100.64.0.0", 10, "ipv4");
BLOCK.addSubnet("127.0.0.0", 8, "ipv4");
BLOCK.addSubnet("169.254.0.0", 16, "ipv4");
BLOCK.addSubnet("172.16.0.0", 12, "ipv4");
BLOCK.addSubnet("192.168.0.0", 16, "ipv4");
BLOCK.addAddress("255.255.255.255", "ipv4");
BLOCK.addAddress("::", "ipv6");
BLOCK.addAddress("::1", "ipv6");
BLOCK.addSubnet("fc00::", 7, "ipv6");
BLOCK.addSubnet("fe80::", 10, "ipv6");

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_HOPS = 3;

export function isBlockedAddress(address: string) {
  const family = isIP(address);
  if (family === 0) return true;
  return BLOCK.check(address, family === 4 ? "ipv4" : "ipv6");
}

function blockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal") return true;
  if (isIP(host)) return isBlockedAddress(host);
  return false;
}

export async function assertPublicHttpsUrl(raw: string, resolveHost: (hostname: string) => Promise<string[]> = resolvePublicHost) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("INVALID_URL");
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("INVALID_URL");
  if (blockedHostname(url.hostname)) throw new Error("BLOCKED_URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!isIP(host)) {
    const addresses = await resolveHost(host);
    if (addresses.length === 0 || addresses.some((address) => isBlockedAddress(address))) throw new Error("BLOCKED_URL");
  }
  return url;
}

async function resolvePublicHost(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export async function fetchPublicText(
  raw: string,
  fetchImpl: typeof fetch = fetch,
  resolveHost?: (hostname: string) => Promise<string[]>,
) {
  let current = raw;
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const url = await assertPublicHttpsUrl(current, resolveHost);
    const response = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("INVALID_URL");
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new Error("URL_FETCH_FAILED");
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > MAX_BYTES) throw new Error("URL_TOO_LARGE");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error("URL_TOO_LARGE");
    return new TextDecoder().decode(bytes).slice(0, 12_000);
  }
  throw new Error("URL_REDIRECT_LIMIT");
}
