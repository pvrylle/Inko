import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/http";
import { getRequestUser } from "@/lib/auth/request-user";
import { executeResearchRun, loadSpokenSummary, openResearchRun } from "@/lib/research/run-analysis";
import { checkRateLimit } from "@/lib/security/rate-limit";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ callId: z.string().min(6).max(200).optional() }).nullable();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return apiError("AUTH_REQUIRED", 401);
  if (user.isDemo) return apiError("SUPABASE_REQUIRED", 503);
  if (!checkRateLimit(`research-analyze:${user.userId}`, 5, 3_600_000).allowed) return apiError("RATE_LIMITED", 429);
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_INPUT", 400);
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return apiError("INVALID_INPUT", 400);

  try {
    const opened = await openResearchRun(user.userId, params.data.id, body.data?.callId ?? null);
    if (opened.reused && opened.run.status === "ready") {
      const summary = await loadSpokenSummary(user.userId, params.data.id);
      return NextResponse.json({ status: "ready", runId: opened.run.id, ...summary });
    }
    if (opened.reused && opened.run.status === "analyzing") {
      return NextResponse.json({ status: "analyzing", runId: opened.run.id });
    }
    if (opened.reused && opened.run.status === "failed") {
      return NextResponse.json({ status: "failed", runId: opened.run.id, error: "ANALYSIS_FAILED" }, { status: 502 });
    }

    const work = executeResearchRun(user.userId, params.data.id, opened.run.id);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raced = await Promise.race([
      work.then((value) => ({ done: true as const, value })),
      new Promise<{ done: false }>((resolve) => {
        timer = setTimeout(() => resolve({ done: false }), 55_000);
      }),
    ]);
    if (timer) clearTimeout(timer);
    if (!raced.done) {
      void work.then(() => undefined, () => undefined);
      return NextResponse.json({ status: "analyzing", runId: opened.run.id });
    }
    if (raced.value.status === "failed") return NextResponse.json({ status: "failed", runId: opened.run.id, error: raced.value.error }, { status: 502 });
    return NextResponse.json({ runId: opened.run.id, ...raced.value });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "REQUEST_FAILED";
    if (code === "NOT_FOUND") return apiError("NOT_FOUND", 404);
    if (code === "NO_SOURCES") return apiError("NO_SOURCES", 409);
    if (code === "SUPABASE_NOT_CONFIGURED") return apiError("SUPABASE_NOT_CONFIGURED", 503);
    return apiError("REQUEST_FAILED", 502);
  }
}
