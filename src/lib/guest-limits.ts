/**
 * Browser-side caps for guests. Signed-in accounts are not counted here;
 * they use the server rate limits instead.
 */

export const GUEST_LIMITS = {
  aiCallsPerDay: 10,
  researchSessions: 2,
  focusMinutes: 25,
  voicePreviews: 3,
} as const;

const STORAGE_KEY = "inko.guest.usage.v2";

type GuestUsage = {
  aiCalls: number;
  researchSessions: number;
  focusMinutes: number;
  voicePreviews: number;
  resetAt: string;
};

function readUsage(): GuestUsage {
  if (typeof window === "undefined") {
    return { aiCalls: 0, researchSessions: 0, focusMinutes: 0, voicePreviews: 0, resetAt: new Date().toISOString() };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GuestUsage;
      if (new Date(parsed.resetAt) > new Date()) return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);
  return { aiCalls: 0, researchSessions: 0, focusMinutes: 0, voicePreviews: 0, resetAt: resetAt.toISOString() };
}

function writeUsage(usage: GuestUsage) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore storage failures
  }
}

export function getGuestUsage(): GuestUsage {
  return readUsage();
}

export function addGuestUsage(field: keyof Omit<GuestUsage, "resetAt">, amount = 1) {
  const usage = readUsage();
  usage[field] += amount;
  writeUsage(usage);
  return usage;
}

export function incrementGuestUsage(field: keyof Omit<GuestUsage, "resetAt">) {
  return addGuestUsage(field, 1);
}

export function getGuestLimitStatus() {
  const usage = readUsage();
  return {
    aiCalls: { used: usage.aiCalls, limit: GUEST_LIMITS.aiCallsPerDay, near: usage.aiCalls >= GUEST_LIMITS.aiCallsPerDay * 0.8 },
    researchSessions: { used: usage.researchSessions, limit: GUEST_LIMITS.researchSessions, near: usage.researchSessions >= GUEST_LIMITS.researchSessions * 0.8 },
    focusMinutes: { used: usage.focusMinutes, limit: GUEST_LIMITS.focusMinutes, near: usage.focusMinutes >= GUEST_LIMITS.focusMinutes * 0.8 },
    voicePreviews: { used: usage.voicePreviews, limit: GUEST_LIMITS.voicePreviews, near: usage.voicePreviews >= GUEST_LIMITS.voicePreviews * 0.8 },
    anyExceeded:
      usage.aiCalls >= GUEST_LIMITS.aiCallsPerDay ||
      usage.researchSessions >= GUEST_LIMITS.researchSessions ||
      usage.focusMinutes >= GUEST_LIMITS.focusMinutes ||
      usage.voicePreviews >= GUEST_LIMITS.voicePreviews,
    anyNear:
      usage.aiCalls >= GUEST_LIMITS.aiCallsPerDay * 0.8 ||
      usage.researchSessions >= GUEST_LIMITS.researchSessions * 0.8 ||
      usage.focusMinutes >= GUEST_LIMITS.focusMinutes * 0.8 ||
      usage.voicePreviews >= GUEST_LIMITS.voicePreviews * 0.8,
  };
}

export function isGuestLimited() {
  return getGuestLimitStatus().anyExceeded;
}
