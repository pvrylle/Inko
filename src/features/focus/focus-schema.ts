import { z } from "zod";

export const focusSessionSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  duration_minutes: z.number().int().min(1).max(180),
  started_at: z.string().datetime(),
  target_ends_at: z.string().datetime(),
  paused_at: z.string().datetime().nullable(),
  accumulated_pause_seconds: z.number().int().nonnegative(),
  completed_at: z.string().datetime().nullable(),
  status: z.enum(["active", "paused", "completed", "cancelled"]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const focusControlActionSchema = z.enum(["pause", "resume", "stop", "complete"]);
