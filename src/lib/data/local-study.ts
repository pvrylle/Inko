"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export async function usesLocalStudyData() {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const user = await Promise.race([
      supabase.auth.getSession().then(({ data }) => data.session?.user ?? null).catch(() => null),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 2500); }),
    ]);
    return !user;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
