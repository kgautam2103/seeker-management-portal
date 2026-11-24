import { offlineDb, type AttendanceOutboxItem, type OutboxItem, type OutboxKind, type RemarkOutboxItem } from "./db";
import { backoffMs, classifyResponse } from "./classify";
import type { SeekerIntakeInput } from "@/modules/seekers/schema";
import type { MarkInput, RemarkInput } from "@/modules/attendance/schema";

const DONE_KEEP_MS = 24 * 60 * 60 * 1000;

/** Stable URLs (not server actions), so entries saved under an older build still sync. */
const ENDPOINT: Record<OutboxKind, string> = {
  seeker: "/api/intake",
  attendance: "/api/attendance",
  remark: "/api/remarks",
};

/** Save an entry on this device. It counts as saved from here on; syncing happens later. */
export async function enqueueSeeker(payload: SeekerIntakeInput & { clientMutationId: string }): Promise<void> {
  const now = Date.now();
  await offlineDb.outbox.put({
    id: payload.clientMutationId,
    kind: "seeker",
    label: payload.fullName.trim(),
    payload,
    status: "pending",
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
  });
}

/**
 * Save one roster tap. An unsent earlier tap for the same person at the same session is replaced:
 * only the latest one matters, and the server would discard the older one anyway.
 */
export async function enqueueMark(payload: MarkInput, label: string): Promise<void> {
  const now = Date.now();
  await offlineDb.transaction("rw", offlineDb.outbox, async () => {
    const stale = await offlineDb.outbox
      .where("kind")
      .equals("attendance")
      .filter((i) => {
        const a = i as AttendanceOutboxItem;
        return a.status !== "done" && a.payload.sessionId === payload.sessionId && a.payload.seekerId === payload.seekerId;
      })
      .primaryKeys();
    await offlineDb.outbox.bulkDelete(stale);
    await offlineDb.outbox.put({
      id: payload.clientMutationId,
      kind: "attendance",
      label,
      payload,
      status: "pending",
      createdAt: now,
      attempts: 0,
      nextAttemptAt: now,
    });
  });
}

/** Save a remark on this device; it syncs like everything else. */
export async function enqueueRemark(payload: RemarkInput, label: string): Promise<void> {
  const now = Date.now();
  const item: RemarkOutboxItem = {
    id: payload.clientMutationId,
    kind: "remark",
    label,
    sessionId: payload.sessionId,
    seekerId: payload.seekerId,
    payload,
    status: "pending",
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
  };
  await offlineDb.outbox.put(item);
}

/** Remove an entry the volunteer chose to discard or to edit (editing re-enqueues it as a new save). */
export async function removeItem(id: string): Promise<OutboxItem | undefined> {
  const item = await offlineDb.outbox.get(id);
  await offlineDb.outbox.delete(id);
  return item;
}

let draining: Promise<void> | null = null;

/** Send pending entries in order. Safe to call often: one drain runs at a time per tab. */
export function drainOutbox(opts: { force?: boolean } = {}): Promise<void> {
  if (draining) return draining;
  draining = runDrain(opts.force ?? false).finally(() => {
    draining = null;
  });
  return draining;
}

async function runDrain(force: boolean): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  // Several open tabs could drain together; the server is idempotent, but a lock avoids wasted requests.
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks) {
    await locks.request("seeker-portal-outbox", { ifAvailable: true }, async (lock) => {
      if (lock) await drainOnce(force);
    });
  } else {
    await drainOnce(force);
  }
  await offlineDb.outbox.where("status").equals("done").and((i) => (i.syncedAt ?? 0) < Date.now() - DONE_KEEP_MS).delete();
}

async function drainOnce(force: boolean): Promise<void> {
  const pending = await offlineDb.outbox.where("status").equals("pending").sortBy("createdAt");
  for (const item of pending) {
    if (!force && item.nextAttemptAt > Date.now()) continue;

    let status: number | "network_error";
    let body: unknown = null;
    try {
      const res = await fetch(ENDPOINT[item.kind], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item.payload),
        credentials: "same-origin",
      });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch {
      status = "network_error";
    }

    const decision = classifyResponse(status, body);
    switch (decision.kind) {
      case "done":
        // Once the server has it, keep only what the lists need: no contact details, no remark text.
        await offlineDb.outbox.update(item.id, {
          status: "done",
          ...(item.kind === "attendance" ? {} : { payload: null }),
          result: decision.result,
          syncedAt: Date.now(),
          lastError: undefined,
          fieldErrors: undefined,
        } as Partial<OutboxItem>);
        break;
      case "needs_attention":
        await offlineDb.outbox.update(item.id, {
          status: "needs_attention",
          lastError: decision.error,
          fieldErrors: decision.fieldErrors,
        } as Partial<OutboxItem>);
        break;
      case "stop":
        await offlineDb.outbox.update(item.id, { lastError: decision.error });
        return;
      case "retry": {
        const attempts = item.attempts + 1;
        await offlineDb.outbox.update(item.id, {
          attempts,
          nextAttemptAt: Date.now() + backoffMs(attempts),
          lastError: decision.error,
        });
        return; // keep order: later entries wait until this one goes through
      }
    }
  }
}
