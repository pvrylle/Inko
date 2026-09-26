import { describe, expect, it } from "vitest";
import { providerIdRewrite, staleVoiceAction, voiceTurnSchema } from "./session-policy";

describe("voice session policy", () => {
  it("binds a provider id once and rejects a rewrite", () => {
    expect(providerIdRewrite(null, "abcde")).toBe("bind");
    expect(providerIdRewrite("abcde", "abcde")).toBe("same");
    expect(providerIdRewrite("abcde", "other")).toBe("conflict");
    expect(providerIdRewrite(null, "bad id")).toBe("invalid");
  });

  it("sweeps unbound and stale active sessions", () => {
    const now = Date.parse("2026-09-26T12:00:00.000Z");
    expect(staleVoiceAction({ status: "active", startedAt: "2026-09-26T11:57:00.000Z", providerSessionId: null, now })).toBe("fail_unbound");
    expect(staleVoiceAction({ status: "active", startedAt: "2026-09-26T11:00:00.000Z", providerSessionId: "abcde", now })).toBe("delete_provider");
    expect(staleVoiceAction({ status: "deletion_pending", startedAt: "2026-09-26T11:59:00.000Z", providerSessionId: "abcde", now })).toBe("delete_provider");
    expect(staleVoiceAction({ status: "active", startedAt: "2026-09-26T11:59:30.000Z", providerSessionId: null, now })).toBe("none");
  });

  it("rejects a transcript over 20000 characters", () => {
    const parsed = voiceTurnSchema.safeParse({
      voiceSessionId: "11111111-1111-4111-8111-111111111111",
      role: "student",
      transcript: "a".repeat(20_001),
    });
    expect(parsed.success).toBe(false);
  });
});
