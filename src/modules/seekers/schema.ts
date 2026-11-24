import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/**
 * Fields captured by the intake form (R1) and the import template (R2). The same schema validates the
 * form in the browser and the request on the server. Normalization (E.164 phone, USPS state) happens
 * server-side in `toIntakeRow`, so a rushed volunteer can type numbers and states however they like.
 */
export const seekerIntakeSchema = z
  .object({
    fullName: z.string().trim().min(1, "Name is required").max(200),
    email: z.string().trim().toLowerCase().email("Check the email address").optional().or(z.literal("")),
    phone: optionalText(40),
    city: z.string().trim().min(1, "City is required").max(120),
    state: optionalText(60),
    countryCode: z.string().trim().length(2).toUpperCase().default("US"),
    howHeard: optionalText(200),
    firstSessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().or(z.literal("")),
    centerId: z.guid("Choose a center"),
    programId: z.guid().optional().or(z.literal("")),
    mentorName: optionalText(200),
    mentorEmail: z.string().trim().toLowerCase().email("Check the mentor's email").optional().or(z.literal("")),
    /** Client-generated for offline idempotency. */
    clientMutationId: z.guid(),
  })
  .refine((v) => Boolean(v.email) || Boolean(v.phone), { message: "Enter an email or a phone number", path: ["email"] })
  .refine((v) => v.countryCode !== "US" || Boolean(v.state), { message: "State is required for US seekers", path: ["state"] });

export type SeekerIntake = z.infer<typeof seekerIntakeSchema>;
export type SeekerIntakeInput = z.input<typeof seekerIntakeSchema>;

export type FieldErrors = Partial<Record<keyof SeekerIntake, string>>;

/** First message per field, in the shape the form renders. */
export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof SeekerIntake | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** What the server reports for one intake entry. */
export type IntakeResult =
  | { outcome: "created"; seekerId: string; possibleDuplicates: number }
  | { outcome: "already_applied"; seekerId: string }
  | { outcome: "matched"; seekerId: string; fullName: string; matchedOn: "email" | "phone" }
  | { outcome: "matched_other_center"; matchedOn: "email" | "phone" };

/** Pre-save lookup for the duplicate warning. */
export type ContactCheck =
  | { match: "none" }
  | { match: "visible"; seekerId: string; fullName: string; centerName: string | null; matchedOn: "email" | "phone" }
  | { match: "other_center"; matchedOn: "email" | "phone" };
