import { normalizePhone } from "@/lib/normalize/phone";
import { normalizeUsState } from "@/lib/normalize/us-state";
import type { ContactCheck, FieldErrors, IntakeResult, SeekerIntake } from "./schema";

/** The normalized payload `intake_seeker(p jsonb)` expects (db/schema.sql, Intake section). */
export type IntakeRow = {
  client_mutation_id: string;
  center_id: string;
  program_id: string | null;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  city: string;
  state: string | null;
  country_code: string;
  how_heard: string | null;
  first_session_at: string | null;
  mentor_name: string | null;
  mentor_email: string | null;
};

const blank = (v: string | undefined) => (v ? v : null);

/** Normalize a validated entry. Only values that cannot be understood at all come back as field errors. */
export function toIntakeRow(input: SeekerIntake): { ok: true; row: IntakeRow } | { ok: false; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};

  let phone: string | null = null;
  if (input.phone) {
    phone = normalizePhone(input.phone, input.countryCode);
    if (!phone) fieldErrors.phone = "Check the phone number (add the country code if it isn't a US number)";
  }

  let state: string | null = blank(input.state);
  if (input.countryCode === "US" && input.state) {
    state = normalizeUsState(input.state);
    if (!state) fieldErrors.state = "Choose a US state";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    row: {
      client_mutation_id: input.clientMutationId,
      center_id: input.centerId,
      program_id: blank(input.programId),
      full_name: input.fullName.replace(/\s+/g, " "),
      email: blank(input.email),
      phone_e164: phone,
      city: input.city.replace(/\s+/g, " "),
      state,
      country_code: input.countryCode,
      how_heard: blank(input.howHeard),
      first_session_at: blank(input.firstSessionDate),
      mentor_name: blank(input.mentorName),
      mentor_email: blank(input.mentorEmail),
    },
  };
}

type Raw = Record<string, unknown>;

/** Map the function's snake_case JSON to the app's result type. */
export function toIntakeResult(raw: Raw): IntakeResult {
  switch (raw.outcome) {
    case "created":
      return { outcome: "created", seekerId: String(raw.seeker_id), possibleDuplicates: Number(raw.possible_duplicates ?? 0) };
    case "already_applied":
      return { outcome: "already_applied", seekerId: String(raw.seeker_id) };
    case "matched":
      return {
        outcome: "matched",
        seekerId: String(raw.seeker_id),
        fullName: String(raw.full_name),
        matchedOn: raw.matched_on === "phone" ? "phone" : "email",
      };
    case "matched_other_center":
      return { outcome: "matched_other_center", matchedOn: raw.matched_on === "phone" ? "phone" : "email" };
    default:
      throw new Error(`Unexpected intake outcome: ${JSON.stringify(raw)}`);
  }
}

export function toContactCheck(raw: Raw): ContactCheck {
  const matchedOn = raw.matched_on === "phone" ? "phone" : "email";
  if (raw.match === "visible") {
    return {
      match: "visible",
      seekerId: String(raw.seeker_id),
      fullName: String(raw.full_name),
      centerName: raw.center_name ? String(raw.center_name) : null,
      matchedOn,
    };
  }
  if (raw.match === "other_center") return { match: "other_center", matchedOn };
  return { match: "none" };
}
