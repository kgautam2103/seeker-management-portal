import Dexie, { type EntityTable } from "dexie";
import type { FieldErrors, IntakeResult, SeekerIntakeInput } from "@/modules/seekers/schema";
import type { MarkInput, MarkResult, RemarkInput, RemarkResult, Roster } from "@/modules/attendance/schema";

/**
 * One write waiting to reach the server, or recently synced (ARCHITECTURE A.3).
 * - pending: will be sent on the next drain
 * - needs_attention: the server rejected it; the volunteer must edit or discard it
 * - done: synced. Seeker contact details and remark text are dropped; attendance keeps its ids and
 *   status so the roster can show the mark until a fresh copy arrives.
 */
type OutboxBase = {
  id: string; // = clientMutationId
  label: string; // the seeker's name, shown in lists
  status: "pending" | "needs_attention" | "done";
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  syncedAt?: number;
};

export type SeekerOutboxItem = OutboxBase & {
  kind: "seeker";
  payload: SeekerIntakeInput | null;
  fieldErrors?: FieldErrors;
  result?: IntakeResult;
};
export type AttendanceOutboxItem = OutboxBase & { kind: "attendance"; payload: MarkInput; result?: MarkResult };
export type RemarkOutboxItem = OutboxBase & {
  kind: "remark";
  /** Kept after sync without the text, so the roster can count it until a fresh copy arrives. */
  sessionId?: string;
  seekerId: string;
  payload: RemarkInput | null;
  result?: RemarkResult;
};

export type OutboxItem = SeekerOutboxItem | AttendanceOutboxItem | RemarkOutboxItem;
export type OutboxKind = OutboxItem["kind"];

/** The last roster fetched for a session, so attendance can be marked with no connection. */
export type CachedRoster = Roster & { sessionId: string };

export const offlineDb = new Dexie("seeker-portal") as Dexie & {
  outbox: EntityTable<OutboxItem, "id">;
  rosters: EntityTable<CachedRoster, "sessionId">;
};

offlineDb.version(1).stores({
  outbox: "id, status, createdAt",
});
offlineDb.version(2).stores({
  outbox: "id, status, createdAt, kind",
  rosters: "sessionId, fetchedAt",
});

export const isSeekerItem = (i: OutboxItem): i is SeekerOutboxItem => i.kind === "seeker";
