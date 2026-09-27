"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export async function usesLocalStudyData() {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return true;
  const { data } = await supabase.auth.getSession();
  return !data.session?.user;
}
