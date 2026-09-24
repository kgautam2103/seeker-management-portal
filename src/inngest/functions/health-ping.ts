import { inngest } from "@/inngest/client";

/** Proves the job pipeline end to end: event → function → step. Replace with real functions as they land. */
export const healthPing = inngest.createFunction(
  { id: "health-ping", retries: 1, triggers: [{ event: "health/ping" }] },
  async ({ event, step }) => {
    const receivedAt = await step.run("record", async () => new Date().toISOString());
    const note = (event.data as { note?: string } | undefined)?.note ?? null;
    return { note, receivedAt };
  },
);
