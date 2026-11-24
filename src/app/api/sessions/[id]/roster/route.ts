import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRoster } from "@/modules/attendance/queries";

/** A fresh copy of a session's roster, which the roster page caches on the device for offline use. */
export async function GET(_request: Request, ctx: RouteContext<"/api/sessions/[id]/roster">) {
  const { id } = await ctx.params;
  if (!z.guid().safeParse(id).success) return Response.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in again." }, { status: 401 });

  const roster = await getRoster(id);
  if (!roster) return Response.json({ error: "Not found" }, { status: 404 });
  // Names of seekers: the browser may cache this only for this user, never shared caches.
  return Response.json(roster, { headers: { "cache-control": "private, no-store" } });
}
