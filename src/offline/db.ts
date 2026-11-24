import Dexie, { type EntityTable } from "dexie";
import type { FieldErrors, IntakeResult, SeekerIntakeInput } from "@/modules/seekers/schema";

/**
 * One entry waiting to reach the server, or recently synced (ARCHITECTURE A.3).
 * - pending: will be sent on the next drain
 * - needs_attention: the server rejected it; the volunteer must edit or discard it
 * - done: synced; the contact details are dropped and only the name and outcome are kept for the list
 */
export type OutboxItem = {
  id: string; // = clientMutationId
  kind: "seeker";
  label: string; // the seeker's name, shown in the list
  payload: SeekerIntakeInput | null;
  status: "pending" | "needs_attention" | "done";
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  fieldErrors?: FieldErrors;
  result?: IntakeResult;
  syncedAt?: number;
};

export const offlineDb = new Dexie("seeker-portal") as Dexie & {
  outbox: EntityTable<OutboxItem, "id">;
};

offlineDb.version(1).stores({
  outbox: "id, status, createdAt",
});
