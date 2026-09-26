import { describe, expect, it } from "vitest";
import { assertPublicHttpsUrl, fetchPublicText, isBlockedAddress } from "./url-guard";

describe("url guard", () => {
  it("blocks private and loopback addresses", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("10.1.2.3")).toBe(true);
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
    expect(isBlockedAddress("192.168.1.9")).toBe(true);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
  });

  it("rejects non-https and private hosts before fetch", async () => {
    await expect(assertPublicHttpsUrl("http://example.com", async () => ["8.8.8.8"])).rejects.toThrow("INVALID_URL");
    await expect(assertPublicHttpsUrl("https://127.0.0.1/secret", async () => [])).rejects.toThrow("BLOCKED_URL");
    await expect(assertPublicHttpsUrl("https://example.com", async () => ["10.0.0.4"])).rejects.toThrow("BLOCKED_URL");
  });

  it("does not follow a redirect onto a private host", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const href = String(input);
      if (href.startsWith("https://example.com")) {
        return new Response(null, { status: 302, headers: { location: "https://127.0.0.1/hidden" } });
      }
      return new Response("should not be read", { status: 200 });
    }) as typeof fetch;

    await expect(fetchPublicText("https://example.com/paper", fetchImpl, async () => ["8.8.8.8"])).rejects.toThrow("BLOCKED_URL");
  });
});
