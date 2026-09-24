"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** Browser client: carries the user's session; every query is subject to RLS. */
export function createClient() {
  const { url, key } = env.supabasePublic();
  return createBrowserClient(url, key);
}
