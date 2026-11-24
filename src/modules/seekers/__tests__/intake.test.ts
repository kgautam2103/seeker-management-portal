import { describe, expect, it } from "vitest";
import { seekerIntakeSchema } from "../schema";
import { toContactCheck, toIntakeResult, toIntakeRow } from "../intake";

const CENTER = "10000000-0000-0000-0000-000000000011";
const base = {
  clientMutationId: "8f1d2c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
  centerId: CENTER,
  fullName: "  Asha   Example ",
  city: "Arlington",
  state: "va",
  email: "Asha@Example.com",
};

const parse = (input: Record<string, unknown>) => seekerIntakeSchema.parse(input);

describe("seekerIntakeSchema", () => {
  it("needs an email or a phone", () => {
    const r = seekerIntakeSchema.safeParse({ ...base, email: "", phone: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["email"]);
  });
  it("needs a state for US seekers only", () => {
    expect(seekerIntakeSchema.safeParse({ ...base, state: "" }).success).toBe(false);
    expect(seekerIntakeSchema.safeParse({ ...base, state: "", countryCode: "gb" }).success).toBe(true);
  });
  it("requires a center", () => {
    expect(seekerIntakeSchema.safeParse({ ...base, centerId: "" }).success).toBe(false);
  });
});

describe("toIntakeRow", () => {
  it("normalizes name spacing, email case, phone and state", () => {
    const r = toIntakeRow(parse({ ...base, phone: "(202) 555-0143", state: "Virginia" }));
    expect(r).toMatchObject({
      ok: true,
      row: { full_name: "Asha Example", email: "asha@example.com", phone_e164: "+12025550143", state: "VA", country_code: "US" },
    });
  });
  it("turns blanks into nulls", () => {
    const r = toIntakeRow(parse({ ...base, phone: "", programId: "", howHeard: "" }));
    expect(r.ok && r.row).toMatchObject({ phone_e164: null, program_id: null, how_heard: null, first_session_at: null });
  });
  it("reports a phone it cannot understand instead of guessing", () => {
    const r = toIntakeRow(parse({ ...base, phone: "call me" }));
    expect(r).toEqual({ ok: false, fieldErrors: { phone: expect.stringContaining("phone") } });
  });
  it("reports an unknown US state", () => {
    const r = toIntakeRow(parse({ ...base, state: "Atlantis" }));
    expect(r.ok).toBe(false);
  });
  it("keeps a non-US region as typed and reads the phone in that country", () => {
    const r = toIntakeRow(parse({ ...base, countryCode: "GB", state: "Kent", phone: "07911 123456" }));
    expect(r.ok && r.row).toMatchObject({ state: "Kent", country_code: "GB", phone_e164: "+447911123456" });
  });
});

describe("toIntakeResult / toContactCheck", () => {
  it("maps each outcome", () => {
    expect(toIntakeResult({ outcome: "created", seeker_id: "s1", possible_duplicates: 2 })).toEqual({
      outcome: "created",
      seekerId: "s1",
      possibleDuplicates: 2,
    });
    expect(toIntakeResult({ outcome: "matched_other_center", matched_on: "phone" })).toEqual({
      outcome: "matched_other_center",
      matchedOn: "phone",
    });
    expect(() => toIntakeResult({ outcome: "surprise" })).toThrow();
  });
  it("never carries details for another center's match", () => {
    expect(toContactCheck({ match: "other_center", matched_on: "email", full_name: "leak" })).toEqual({
      match: "other_center",
      matchedOn: "email",
    });
  });
});
