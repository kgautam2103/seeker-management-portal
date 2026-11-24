import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Common start of an outbox endpoint: JSON only (a cross-site HTML form can't send it without a
 * CORS preflight) and a signed-in user. Returns the session client (RLS applies, AD-3) or a response.
 */
export async function startJsonRoute(
  request: Request,
): Promise<{ supabase: Supabase; body: unknown } | { response: Response }> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return { response: Response.json({ error: "Expected application/json" }, { status: 415 }) };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: Response.json({ error: "Sign in again to sync." }, { status: 401 }) };
  return { supabase, body: await request.json().catch(() => null) };
}

/**
 * Database errors as outbox responses: 403 not allowed and 422 bad input need the volunteer;
 * anything else is retried (see src/offline/classify.ts).
 */
export function dbErrorResponse(error: PostgrestError, what: string, forbidden: string): Response {
  if (error.code === "42501") return Response.json({ error: forbidden }, { status: 403 });
  if (error.code?.startsWith("22") || error.code?.startsWith("23")) {
    return Response.json({ error: error.message }, { status: 422 });
  }
  console.error(`${what} failed`, error.code, error.message);
  return Response.json({ error: "The server could not save this. It will retry." }, { status: 500 });
}
