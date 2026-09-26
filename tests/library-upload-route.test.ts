import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const getRequestUser = vi.fn();
vi.mock("@/lib/auth/request-user", () => ({ getRequestUser: (...args: unknown[]) => getRequestUser(...args) }));

describe("library upload route", () => {
  beforeEach(() => {
    getRequestUser.mockReset();
  });

  it("rejects an upload that is not a file before storage", async () => {
    getRequestUser.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", isDemo: false });
    const { POST } = await import("@/app/api/library/files/route");
    const response = await POST(new NextRequest("http://localhost/api/library/files", {
      method: "POST",
      body: JSON.stringify({ classId: "22222222-2222-4222-8222-222222222222", file: "virus.exe" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_INPUT" });
  });

  it("does not give demo users a signed file url", async () => {
    getRequestUser.mockResolvedValue({ userId: "11111111-1111-4111-8111-111111111111", isDemo: true });
    const { GET } = await import("@/app/api/library/files/[id]/url/route");
    const response = await GET(new NextRequest("http://localhost/api/library/files/22222222-2222-4222-8222-222222222222/url"), {
      params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }),
    });
    expect(response.status).toBe(503);
  });
});
