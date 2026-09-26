import { z } from "zod";

const PROVIDER_ID = /^[A-Za-z0-9_-]{5,200}$/;

export function providerIdRewrite(current: string | null, incoming: string) {
  if (!PROVIDER_ID.test(incoming)) return "invalid" as const;
  if (!current) return "bind" as const;
  if (current === incoming) return "same" as const;
  return "conflict" as const;
}

export function staleVoiceAction(input: {
  status: string;
  startedAt: string;
  providerSessionId: string | null;
  now: number;
}) {
  if (input.status === "deletion_pending" && input.providerSessionId) return "delete_provider" as const;
  if (input.status !== "active") return "none" as const;
  const age = input.now - Date.parse(input.startedAt);
  if (!Number.isFinite(age)) return "none" as const;
  if (!input.providerSessionId && age > 2 * 60_000) return "fail_unbound" as const;
  if (age > 30 * 60_000) return "delete_provider" as const;
  return "none" as const;
}

export const voiceTurnSchema = z.object({
  voiceSessionId: z.string().uuid(),
  role: z.enum(["student", "inko"]),
  transcript: z.string().trim().min(1).max(20_000),
  interrupted: z.boolean().optional().default(false),
});
