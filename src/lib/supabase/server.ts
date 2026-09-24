import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Server client for server components, server actions and route handlers.
 * Uses the request's cookies, so it acts as the signed-in user and RLS applies (AD-3).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = env.supabasePublic();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there. The proxy refreshes sessions.
        }
      },
    },
  });
}
