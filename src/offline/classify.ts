import type { FieldErrors } from "@/modules/seekers/schema";

/** What the outbox does with one sync attempt's response. Pure, so it is unit-tested. */
export type SyncDecision =
  | { kind: "done"; result: unknown } // the endpoint's result for this kind of entry
  | { kind: "needs_attention"; error: string; fieldErrors?: FieldErrors }
  | { kind: "stop"; error: string } // signed out: keep everything, stop draining until the session is back
  | { kind: "retry"; error: string }; // network or server trouble: back off and try again

export function classifyResponse(status: number | "network_error", body: unknown): SyncDecision {
  const b = (body ?? {}) as { error?: string; fieldErrors?: FieldErrors };
  if (status === "network_error") return { kind: "retry", error: "No connection. Will send when online." };
  if (status === 200) return { kind: "done", result: body };
  if (status === 401) return { kind: "stop", error: "Sign in again to send saved entries." };
  if (status === 403) return { kind: "needs_attention", error: b.error ?? "You don't have access to this center." };
  if (status === 422 || status === 415) {
    return { kind: "needs_attention", error: b.error ?? "Some details need fixing.", fieldErrors: b.fieldErrors };
  }
  return { kind: "retry", error: b.error ?? `Server error (${status}). Will retry.` };
}

/** Exponential backoff for retries: 5 s, 10 s, 20 s … capped at 5 minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 300_000);
}
