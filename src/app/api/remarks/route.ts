import { dbErrorResponse, startJsonRoute } from "@/lib/api/route";
import { remarkSchema, toRemarkResult } from "@/modules/attendance/schema";

/**
 * Saves one remark (R5). Internal only: remarks are never rendered into messages, exports or AI
 * prompts. Replayed by the offline outbox, idempotent by clientMutationId.
 */
export async function POST(request: Request) {
  const start = await startJsonRoute(request);
  if ("response" in start) return start.response;

  const parsed = remarkSchema.safeParse(start.body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "This note couldn't be read." }, { status: 422 });
  }
  const r = parsed.data;

  const { data, error } = await start.supabase.rpc("add_remark", {
    p: { client_mutation_id: r.clientMutationId, session_id: r.sessionId ?? null, seeker_id: r.seekerId, body: r.body, tags: r.tags },
  });
  if (error) return dbErrorResponse(error, "add_remark", "You can't add notes for this seeker.");
  return Response.json(toRemarkResult(data as Record<string, unknown>));
}
