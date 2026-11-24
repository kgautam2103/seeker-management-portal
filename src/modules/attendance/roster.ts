import type { AttendanceOutboxItem, OutboxItem, RemarkOutboxItem } from "@/offline/db";
import type { AttendanceStatus, Roster, RosterEntry } from "./schema";

/** A roster row as the instructor sees it: the server's copy with this device's writes on top. */
export type RosterRow = RosterEntry & {
  /** This device's latest tap hasn't reached the server yet. */
  syncing: boolean;
  /** The server rejected this device's latest tap; the message says why. */
  problem: string | null;
  problemItemId: string | null;
};

const isMark = (i: OutboxItem, sessionId: string): i is AttendanceOutboxItem =>
  i.kind === "attendance" && i.payload.sessionId === sessionId;
const isRemark = (i: OutboxItem, sessionId: string): i is RemarkOutboxItem =>
  i.kind === "remark" && i.sessionId === sessionId;

/**
 * Merge the outbox into a roster. A tap from this device shows when it is newer than the server's
 * mark (or the server's copy predates it); a synced tap shows what the server kept, which may be
 * someone else's later tap. Walk-ins marked on this device appear even before the roster is refetched.
 */
export function mergeRoster(roster: Roster, outbox: OutboxItem[]): RosterRow[] {
  const sessionId = roster.session.id;
  const rows = new Map<string, RosterRow>(
    roster.entries.map((e) => [e.seekerId, { ...e, syncing: false, problem: null, problemItemId: null }]),
  );

  const time = (iso: string | null) => (iso ? Date.parse(iso) : 0); // the server writes +00:00, browsers write Z
  const marks = outbox
    .filter((i) => isMark(i, sessionId))
    .sort((a, b) => time(a.payload.markedAt) - time(b.payload.markedAt));
  for (const m of marks) {
    const { seekerId, markedAt } = m.payload;
    let row = rows.get(seekerId);
    if (!row) {
      row = {
        seekerId,
        fullName: m.label,
        registered: false,
        status: null,
        markedAt: null,
        isNew: null,
        remarkCount: 0,
        syncing: false,
        problem: null,
        problemItemId: null,
      };
      rows.set(seekerId, row);
    }
    if (m.status === "needs_attention") {
      row.problem = m.lastError ?? "Not saved.";
      row.problemItemId = m.id;
      continue;
    }
    // The server's copy is as new as this tap (so it already reflects it, or a later one): keep it.
    if (time(row.markedAt) >= time(markedAt) && (m.syncedAt ?? 0) <= roster.fetchedAt) continue;

    const status: AttendanceStatus = m.status === "done" && m.result ? m.result.status : m.payload.status;
    row.status = status;
    row.markedAt = markedAt;
    row.syncing = m.status === "pending";
    row.problem = null;
    row.problemItemId = null;
    if (m.status === "done" && m.result && row.isNew === null) row.isNew = m.result.firstVisit;
  }

  // Notes saved on this device that the fetched roster doesn't count yet.
  for (const r of outbox) {
    if (!isRemark(r, sessionId) || r.status === "needs_attention") continue;
    if (r.status === "done" && (r.syncedAt ?? 0) <= roster.fetchedAt) continue;
    const row = rows.get(r.seekerId);
    if (row) row.remarkCount += 1;
  }

  return [...rows.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));
}

/** Counts for the roster header. */
export function rosterCounts(rows: RosterRow[]): { present: number; absent: number; unmarked: number; waiting: number } {
  let present = 0;
  let absent = 0;
  let waiting = 0;
  for (const r of rows) {
    if (r.status === "present") present += 1;
    else if (r.status === "absent") absent += 1;
    if (r.syncing) waiting += 1;
  }
  return { present, absent, unmarked: rows.length - present - absent, waiting };
}
