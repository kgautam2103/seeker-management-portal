import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so it is only for background jobs and webhook handlers,
 * and every write made with it must set center_id explicitly (AD-3). Never import from client code.
 *
 * The `scope` argument is deliberate friction: callers must state which center (or `system`)
 * the work is for, and it is attached to audit_log entries.
 */
export function createServiceClient(scope: { centerId: string } | { system: string }) {
  const { url } = env.supabasePublic();
  const client = createSupabaseClient(url, env.supabaseServiceRole(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-portal-scope": "centerId" in scope ? `center:${scope.centerId}` : `system:${scope.system}` } },
  });
  return client;
}
