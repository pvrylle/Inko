import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getRequestUser = vi.fn();
vi.mock("@/lib/auth/request-user", () => ({ getRequestUser: (...args: unknown[]) => getRequestUser(...args) }));

const createServerSupabaseClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => createServerSupabaseClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => null }));
vi.mock("@/lib/voice/provider-delete", () => ({ deleteAssemblySession: vi.fn(async () => "deleted") }));

describe("voice routes", () => {
  beforeEach(() => {
    getRequestUser.mockReset();
    createServerSupabaseClient.mockReset();
    delete process.env.CRON_SECRET;
  });

  it("rejects a token request without a user", async () => {
    getRequestUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/voice/token/route");
    const response = await POST(new NextRequest("http://localhost/api/voice/token", { method: "POST" }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTH_REQUIRED" });
  });

  it("rejects a second provider id on an active session", async () => {
    getRequestUser.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", isDemo: false });
    createServerSupabaseClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { provider_session_id: "already", status: "active" }, error: null }),
            }),
          }),
        }),
      }),
    });
    const { PATCH } = await import("@/app/api/voice/session/route");
    const response = await PATCH(new NextRequest("http://localhost/api/voice/session", {
      method: "PATCH",
      body: JSON.stringify({
        voiceSessionId: "22222222-2222-4222-8222-222222222222",
        providerSessionId: "different",
      }),
    }));
    expect(response.status).toBe(409);
  });

  it("treats an already deleted voice session as ended", async () => {
    getRequestUser.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", isDemo: false });
    createServerSupabaseClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { provider_session_id: "already", status: "deleted" }, error: null }),
            }),
          }),
        }),
      }),
    });
    const { POST } = await import("@/app/api/voice/session/end/route");
    const response = await POST(new NextRequest("http://localhost/api/voice/session/end", {
      method: "POST",
      body: JSON.stringify({ voiceSessionId: "22222222-2222-4222-8222-222222222222" }),
    }));
    expect(response.status).toBe(204);
  });

  it("rejects an oversized transcript before writing", async () => {
    getRequestUser.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", isDemo: false });
    const { POST } = await import("@/app/api/voice/turns/route");
    const response = await POST(new NextRequest("http://localhost/api/voice/turns", {
      method: "POST",
      body: JSON.stringify({
        voiceSessionId: "22222222-2222-4222-8222-222222222222",
        role: "student",
        transcript: "a".repeat(20_001),
      }),
    }));
    expect(response.status).toBe(400);
  });

  it("rejects cleanup without the cron secret", async () => {
    const { POST } = await import("@/app/api/cron/voice-cleanup/route");
    const response = await POST(new NextRequest("http://localhost/api/cron/voice-cleanup", { method: "POST" }));
    expect(response.status).toBe(401);
  });
});
