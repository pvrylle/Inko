"use client";

const DEMO_USER_KEY = "inko.demo-user-id";

export async function inkoFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const demoUserId = window.localStorage.getItem(DEMO_USER_KEY);
  if (demoUserId) headers.set("x-inko-demo-user", demoUserId);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  return fetch(input, { ...init, headers });
}
