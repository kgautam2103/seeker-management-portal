import { createClient } from "@/lib/supabase/server";
import { toRosterEntry, type Roster, type RosterSession, type SeekerMatch } from "./schema";

export type SessionSummary = {
  id: string;
  programId: string;
  programName: string;
  centerName: string;
  timezone: string;
  startsAt: string;
  status: RosterSession["status"];
  registered: number;
  present: number;
};

/** Sessions from the last two weeks and the next week at the user's centers. Reads through RLS. */
export async function getRecentSessions(): Promise<SessionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recent_sessions");
  if (error) throw new Error(`Could not load sessions: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.session_id),
    programId: String(r.program_id),
    programName: String(r.program_name),
    centerName: String(r.center_name),
    timezone: String(r.timezone),
    startsAt: String(r.starts_at),
    status: r.status as RosterSession["status"],
    registered: Number(r.registered),
    present: Number(r.present),
  }));
}

/** The session and its roster, or null when it doesn't exist or isn't visible to this user. */
export async function getRoster(sessionId: string): Promise<Roster | null> {
  const supabase = await createClient();
  const session = await supabase
    .from("session")
    .select("id, starts_at, status, program:program_id (id, name), center:center_id (id, name, timezone)")
    .eq("id", sessionId)
    .maybeSingle();
  if (session.error) throw new Error(`Could not load the session: ${session.error.message}`);
  if (!session.data) return null;

  const roster = await supabase.rpc("session_roster", { p_session_id: sessionId });
  if (roster.error) throw new Error(`Could not load the roster: ${roster.error.message}`);

  const s = session.data as unknown as {
    id: string;
    starts_at: string;
    status: RosterSession["status"];
    program: { id: string; name: string };
    center: { id: string; name: string; timezone: string };
  };
  return {
    session: {
      id: s.id,
      programId: s.program.id,
      programName: s.program.name,
      centerId: s.center.id,
      centerName: s.center.name,
      timezone: s.center.timezone,
      startsAt: s.starts_at,
      status: s.status,
    },
    entries: ((roster.data ?? []) as Record<string, unknown>[]).map(toRosterEntry),
    fetchedAt: Date.now(),
  };
}

/** Escape LIKE wildcards so a typed "%" or "_" matches literally. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Name search for adding a walk-in to a roster: the user's centers only (RLS), names and cities only. */
export async function searchSeekers(q: string): Promise<SeekerMatch[]> {
  const term = q.trim().replace(/\s+/g, " ");
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seeker")
    .select("id, full_name, city")
    .ilike("full_name", likePattern(term))
    .is("merged_into_id", null)
    .is("anonymized_at", null)
    .order("full_name")
    .limit(8);
  if (error) throw new Error(`Search failed: ${error.message}`);
  return data.map((r) => ({ id: r.id, fullName: r.full_name, city: r.city }));
}
