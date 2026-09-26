"use client";

import { incrementGuestUsage } from "@/lib/guest-limits";

const DEMO_USER_KEY = "inko.demo-user-id";

function isAiCall(input: RequestInfo | URL): boolean {
  const path = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  return /\/api\/(chat|study\/)/.test(path);
}

export async function inkoFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const demoUserId = window.localStorage.getItem(DEMO_USER_KEY);
  if (demoUserId) headers.set("x-inko-demo-user", demoUserId);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");

  if (isAiCall(input)) {
    incrementGuestUsage("aiCalls");
  }

  return fetch(input, { ...init, headers });
}
