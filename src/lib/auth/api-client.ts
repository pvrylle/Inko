"use client";

import { addGuestUsage, getGuestUsage, GUEST_LIMITS } from "@/lib/guest-limits";
import { usesLocalStudyData } from "@/lib/data/local-study";

const DEMO_USER_KEY = "inko.demo-user-id";

type GuestMeter = "aiCalls" | "researchSessions" | "focusMinutes" | "voicePreviews";

function requestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return input.split("?")[0] ?? input;
  if (input instanceof URL) return input.pathname;
  return input.url.split("?")[0] ?? input.url;
}

function guestMeter(path: string, method: string): GuestMeter | null {
  const verb = method.toUpperCase();
  if (verb === "POST" && path === "/api/research/sessions") return "researchSessions";
  if (verb === "POST" && path === "/api/voice/token") return "voicePreviews";
  if (verb === "POST" && path === "/api/study/focus/start") return "focusMinutes";
  if (/^\/api\/(chat|study\/(notes|flashcards|quizzes|plan))/.test(path)) return "aiCalls";
  return null;
}

function meterLimit(meter: GuestMeter) {
  if (meter === "aiCalls") return GUEST_LIMITS.aiCallsPerDay;
  return GUEST_LIMITS[meter];
}

function meterAmount(meter: GuestMeter, body: BodyInit | null | undefined) {
  if (meter !== "focusMinutes" || typeof body !== "string") return 1;
  try {
    const minutes = Number((JSON.parse(body) as { minutes?: unknown }).minutes);
    return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 1;
  } catch {
    return 1;
  }
}

export async function inkoFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const demoUserId = window.localStorage.getItem(DEMO_USER_KEY);
  if (demoUserId) headers.set("x-inko-demo-user", demoUserId);
  if (!headers.has("content-type") && init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");

  const meter = guestMeter(requestPath(input), init.method ?? "GET");
  if (meter && await usesLocalStudyData()) {
    const amount = meterAmount(meter, init.body);
    if (getGuestUsage()[meter] + amount > meterLimit(meter)) {
      return new Response(JSON.stringify({ error: "GUEST_LIMIT" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
    addGuestUsage(meter, amount);
  }

  return fetch(input, { ...init, headers });
}
