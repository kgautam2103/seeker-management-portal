import { describe, expect, it } from "vitest";
import { backoffMs, classifyResponse } from "../classify";

describe("classifyResponse", () => {
  it("marks a saved entry done", () => {
    const result = { outcome: "created", seekerId: "s1", possibleDuplicates: 0 };
    expect(classifyResponse(200, result)).toEqual({ kind: "done", result });
  });
  it("retries when offline or the server fails, so nothing is lost", () => {
    expect(classifyResponse("network_error", null).kind).toBe("retry");
    expect(classifyResponse(500, { error: "boom" }).kind).toBe("retry");
    expect(classifyResponse(503, null).kind).toBe("retry");
  });
  it("stops (keeping everything) when the session has expired", () => {
    expect(classifyResponse(401, null).kind).toBe("stop");
  });
  it("asks the volunteer to fix entries the server rejects", () => {
    expect(classifyResponse(422, { fieldErrors: { phone: "Check" } })).toEqual({
      kind: "needs_attention",
      error: "Some details need fixing.",
      fieldErrors: { phone: "Check" },
    });
    expect(classifyResponse(403, { error: "No" })).toEqual({ kind: "needs_attention", error: "No" });
  });
});

describe("backoffMs", () => {
  it("doubles from 5 s and caps at 5 minutes", () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([5_000, 10_000, 20_000]);
    expect(backoffMs(20)).toBe(300_000);
  });
});
