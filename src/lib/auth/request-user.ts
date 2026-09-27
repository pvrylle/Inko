import "server-only";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type RequestUser = { userId: string; isDemo: boolean };

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name));
}

export async function getRequestUser(request: NextRequest): Promise<RequestUser | null> {
  const demoId = request.headers.get("x-inko-demo-user");
  const demoUser = demoId && /^[0-9a-f-]{36}$/i.test(demoId) ? { userId: demoId, isDemo: true } : null;

  if (!isSupabaseConfigured) return demoUser;

  // Guests have no auth cookie. Treat a valid demo header as a local study user
  // so research and challenge tools still work without a Supabase account.
  if (!hasSupabaseSessionCookie(request)) return demoUser;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase!.auth.getUser();
  return !error && data.user ? { userId: data.user.id, isDemo: false } : null;
}
