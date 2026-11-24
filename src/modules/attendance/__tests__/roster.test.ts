import { describe, expect, it } from "vitest";
import { mergeRoster, rosterCounts } from "../roster";
import { markSchema, toMarkResult, toRosterEntry, type Roster } from "../schema";
import type { AttendanceOutboxItem, RemarkOutboxItem } from "@/offline/db";

const SESSION = "20000000-0000-0000-0000-000000000001";
const ASHA = "30000000-0000-0000-0000-000000000001";
const RAVI = "30000000-0000-0000-0000-000000000002";
const FETCHED = Date.parse("2026-11-24T19:00:00Z");

const roster = (entries: Partial<Roster["entries"][number]>[] = []): Roster => ({
  session: {
    id: SESSION,
    programId: "p",
    programName: "Tuesday meditation",
    centerId: "c",
    centerName: "Center one",
    timezone: "America/New_York",
    startsAt: "2026-11-24T23:00:00+00:00",
    status: "scheduled",
  },
  entries: entries.map((e) => ({
    seekerId: ASHA,
    fullName: "Asha Example",
    registered: true,
    status: null,
    markedAt: null,
    isNew: false,
    remarkCount: 0,
    ...e,
  })),
  fetchedAt: FETCHED,
});

let n = 0;
/** `tap` is what was tapped; `status` is the outbox state (pending by default). */
const mark = (over: Partial<AttendanceOutboxItem> & { markedAt: string; tap?: "present" | "absent"; seekerId?: string }) => {
  const { markedAt, tap = "present", seekerId = ASHA, ...rest } = over;
  n += 1;
  return {
    id: `m${n}`,
    kind: "attendance",
    label: "Asha Example",
    payload: { clientMutationId: `m${n}`, sessionId: SESSION, seekerId, status: tap, markedAt },
    status: "pending",
    createdAt: n,
    attempts: 0,
    nextAttemptAt: 0,
    ...rest,
  } satisfies AttendanceOutboxItem;
};

describe("mergeRoster", () => {
  it("shows an unsent tap as waiting", () => {
    const [row] = mergeRoster(roster([{}]), [mark({ markedAt: "2026-11-24T19:05:00.000Z" })]);
    expect(row).toMatchObject({ status: "present", syncing: true, problem: null });
  });

  it("keeps the latest of several taps", () => {
    const rows = mergeRoster(roster([{}]), [
      mark({ markedAt: "2026-11-24T19:06:00.000Z", tap: "absent" }),
      mark({ markedAt: "2026-11-24T19:05:00.000Z", tap: "present" }),
    ]);
    expect(rows[0].status).toBe("absent");
  });

  it("keeps the server's mark when it is newer, comparing times not strings", () => {
    const rows = mergeRoster(roster([{ status: "absent", markedAt: "2026-11-24T19:10:00+00:00" }]), [
      mark({ markedAt: "2026-11-24T19:05:00.000Z" }),
    ]);
    expect(rows[0]).toMatchObject({ status: "absent", syncing: false });
  });

  it("shows what the server kept for a tap synced after the roster was fetched", () => {
    const synced = mark({
      markedAt: "2026-11-24T19:05:00.000Z",
      status: "done",
      syncedAt: FETCHED + 1000,
      result: { outcome: "superseded", status: "absent", firstVisit: false },
    });
    expect(mergeRoster(roster([{}]), [synced])[0]).toMatchObject({ status: "absent", syncing: false });
  });

  it("flags a rejected tap without changing the status", () => {
    const rejected = mark({ markedAt: "2026-11-24T19:05:00.000Z", status: "needs_attention", lastError: "Session was cancelled" });
    expect(mergeRoster(roster([{ status: "absent", markedAt: "2026-11-24T19:00:00Z" }]), [rejected])[0]).toMatchObject({
      status: "absent",
      problem: "Session was cancelled",
      problemItemId: rejected.id,
    });
  });

  it("adds a walk-in marked on this device", () => {
    const rows = mergeRoster(roster([{}]), [{ ...mark({ markedAt: "2026-11-24T19:05:00.000Z", seekerId: RAVI }), label: "Ravi Example" }]);
    expect(rows.map((r) => [r.fullName, r.registered, r.isNew])).toEqual([
      ["Asha Example", true, false],
      ["Ravi Example", false, null],
    ]);
  });

  it("ignores other sessions and counts notes not yet in the fetched roster", () => {
    const note = (status: RemarkOutboxItem["status"], syncedAt?: number): RemarkOutboxItem => ({
      id: `r${status}${syncedAt}`,
      kind: "remark",
      label: "Asha Example",
      sessionId: SESSION,
      seekerId: ASHA,
      payload: null,
      status,
      createdAt: 0,
      attempts: 0,
      nextAttemptAt: 0,
      syncedAt,
    });
    const other = mark({ markedAt: "2026-11-24T19:05:00.000Z" });
    other.payload = { ...other.payload, sessionId: "20000000-0000-0000-0000-000000000099" };
    const [row] = mergeRoster(roster([{ remarkCount: 1 }]), [other, note("pending"), note("done", FETCHED - 1), note("done", FETCHED + 1)]);
    expect(row).toMatchObject({ status: null, remarkCount: 3 });
  });
});

describe("rosterCounts", () => {
  it("counts marks and waiting taps", () => {
    const rows = mergeRoster(roster([{}, { seekerId: RAVI, fullName: "Ravi", status: "absent", markedAt: "2026-11-24T18:00:00Z" }]), [
      mark({ markedAt: "2026-11-24T19:05:00.000Z" }),
    ]);
    expect(rosterCounts(rows)).toEqual({ present: 1, absent: 1, unmarked: 0, waiting: 1 });
  });
});

describe("attendance schema", () => {
  it("accepts a tap with the device's time and rejects bad input", () => {
    const ok = { clientMutationId: "8f1d2c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f", sessionId: SESSION, seekerId: ASHA, status: "present" };
    expect(markSchema.safeParse({ ...ok, markedAt: new Date().toISOString() }).success).toBe(true);
    expect(markSchema.safeParse({ ...ok, markedAt: "yesterday" }).success).toBe(false);
    expect(markSchema.safeParse({ ...ok, status: "late", markedAt: new Date().toISOString() }).success).toBe(false);
  });
  it("maps database rows", () => {
    expect(toMarkResult({ outcome: "superseded", status: "present", first_visit: false })).toEqual({
      outcome: "superseded",
      status: "present",
      firstVisit: false,
    });
    expect(() => toMarkResult({ outcome: "nope", status: "present" })).toThrow();
    expect(toRosterEntry({ seeker_id: ASHA, full_name: "Asha", registered: true, status: null, marked_at: null, is_new: true, remark_count: 2 }))
      .toMatchObject({ status: null, isNew: true, remarkCount: 2 });
  });
});
