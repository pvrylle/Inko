import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./config";

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name));
}

export async function refreshSupabaseSession(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next({ request });
  // Guests have no session. Skip the auth round trip so a home question is not waiting on Supabase.
  if (!hasSupabaseSessionCookie(request)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}
