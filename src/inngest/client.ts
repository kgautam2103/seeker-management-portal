import { Inngest } from "inngest";

/** Every event the portal emits. Names are the contract; payloads are typed for callers via `sendEvent`. */
export type PortalEvents = {
  "health/ping": { note?: string };
  "seeker/created": { seekerId: string; centerId: string | null; source: "intake" | "import" | "eventbrite" };
  "attendance/recorded": { attendanceId: string; sessionId: string; seekerId: string; centerId: string };
  "registration/created": { registrationId: string; seekerId: string; sessionId: string | null };
  "import/batch.created": { batchId: string };
  "message/queued": { messageId: string };
};

export type PortalEventName = keyof PortalEvents;

export const inngest = new Inngest({ id: "seeker-portal" });

/** Type-checked event sending; all modules go through this rather than `inngest.send` directly. */
export function sendEvent<K extends PortalEventName>(name: K, data: PortalEvents[K]) {
  return inngest.send({ name, data });
}
