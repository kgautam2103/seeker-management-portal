import { dbErrorResponse, startJsonRoute } from "@/lib/api/route";
import { markSchema, toMarkResult } from "@/modules/attendance/schema";

/**
 * Records one roster tap (R5). The offline outbox replays taps here, so this is a route handler with
 * a stable URL rather than a server action. The database keeps the later tap per (session, seeker).
 *
 * 200 → MarkResult · 401 signed out · 403 not this user's session · 422 bad tap · 5xx retry later.
 */
export async function POST(request: Request) {
  const start = await startJsonRoute(request);
  if ("response" in start) return start.response;

  const parsed = markSchema.safeParse(start.body);
  if (!parsed.success) return Response.json({ error: "This tap couldn't be read." }, { status: 422 });
  const m = parsed.data;

  const { data, error } = await start.supabase.rpc("mark_attendance", {
    p: {
      client_mutation_id: m.clientMutationId,
      session_id: m.sessionId,
      seeker_id: m.seekerId,
      status: m.status,
      marked_at: m.markedAt,
    },
  });
  if (error) return dbErrorResponse(error, "mark_attendance", "You can't mark attendance for this session.");
  return Response.json(toMarkResult(data as Record<string, unknown>));
}
