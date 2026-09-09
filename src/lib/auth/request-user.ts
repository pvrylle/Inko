import "server-only";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type RequestUser = { userId: string; isDemo: boolean };

export async function getRequestUser(request: NextRequest): Promise<RequestUser | null> {
  if (!isSupabaseConfigured) {
    const demoId = request.headers.get("x-inko-demo-user");
    return demoId && /^[0-9a-f-]{36}$/i.test(demoId) ? { userId: demoId, isDemo: true } : null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase!.auth.getUser();
  return !error && data.user ? { userId: data.user.id, isDemo: false } : null;
}
