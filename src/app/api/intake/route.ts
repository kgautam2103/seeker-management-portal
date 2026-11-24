import { createClient } from "@/lib/supabase/server";
import { fieldErrorsOf, seekerIntakeSchema } from "@/modules/seekers/schema";
import { toIntakeResult, toIntakeRow } from "@/modules/seekers/intake";

/**
 * Saves one intake entry (R1). The offline outbox replays entries here, so this is a route handler
 * with a stable URL rather than a server action: action IDs change between deployments, and a phone
 * may hold entries made under an older build. Runs as the signed-in user (AD-3).
 *
 * 200 → IntakeResult · 401 signed out · 403 center not allowed · 422 fix the entry · 5xx retry later.
 */
export async function POST(request: Request) {
  // JSON only: a cross-site HTML form cannot send this content type without a CORS preflight.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Expected application/json" }, { status: 415 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in again to sync." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = seekerIntakeSchema.safeParse(body);
  if (!parsed.success) return Response.json({ fieldErrors: fieldErrorsOf(parsed.error) }, { status: 422 });

  const normalized = toIntakeRow(parsed.data);
  if (!normalized.ok) return Response.json({ fieldErrors: normalized.fieldErrors }, { status: 422 });

  const { data, error } = await supabase.rpc("intake_seeker", { p: normalized.row });
  if (error) {
    if (error.code === "42501") return Response.json({ error: "You can't add seekers to this center." }, { status: 403 });
    // Bad input the database caught (unknown program, constraint): the volunteer has to fix the entry.
    if (error.code === "22023" || error.code?.startsWith("23")) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error("intake_seeker failed", error);
    return Response.json({ error: "The server could not save this entry. It will retry." }, { status: 500 });
  }
  return Response.json(toIntakeResult(data as Record<string, unknown>));
}
