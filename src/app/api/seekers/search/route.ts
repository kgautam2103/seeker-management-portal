import { z } from "zod";
import { startJsonRoute } from "@/lib/api/route";
import { searchSeekers } from "@/modules/attendance/queries";

/** Name search for walk-ins. POST so names stay out of URLs and logs. Online only. */
export async function POST(request: Request) {
  const start = await startJsonRoute(request);
  if ("response" in start) return start.response;
  const parsed = z.object({ q: z.string().max(100) }).safeParse(start.body);
  if (!parsed.success) return Response.json({ error: "Bad search" }, { status: 422 });
  return Response.json({ matches: await searchSeekers(parsed.data.q) }, { headers: { "cache-control": "no-store" } });
}
