import { createClient } from "@/lib/supabase/server";

export type IntakeCenter = { id: string; name: string; countryCode: string | null; timezone: string };
export type IntakeProgram = { id: string; centerId: string; name: string };
export type IntakeOptions = { centers: IntakeCenter[]; programs: IntakeProgram[] };

/** Centers the signed-in user may add seekers to, and their active programs. Reads through RLS. */
export async function getIntakeOptions(): Promise<IntakeOptions> {
  const supabase = await createClient();

  const { data: ids, error: idsError } = await supabase.rpc("visible_center_ids");
  if (idsError) throw new Error(`Could not load your centers: ${idsError.message}`);
  const centerIds = ((ids ?? []) as unknown[]).map((row) =>
    typeof row === "string" ? row : String((row as Record<string, unknown>).visible_center_ids),
  );
  if (centerIds.length === 0) return { centers: [], programs: [] };

  const [centers, programs] = await Promise.all([
    supabase.from("center").select("id, name, country_code, timezone").in("id", centerIds).eq("is_active", true).order("name"),
    supabase.from("program").select("id, center_id, name").in("center_id", centerIds).eq("is_active", true).order("name"),
  ]);
  if (centers.error) throw new Error(`Could not load centers: ${centers.error.message}`);
  if (programs.error) throw new Error(`Could not load programs: ${programs.error.message}`);

  return {
    centers: centers.data.map((c) => ({ id: c.id, name: c.name, countryCode: c.country_code, timezone: c.timezone })),
    programs: programs.data.map((p) => ({ id: p.id, centerId: p.center_id, name: p.name })),
  };
}
