import { z } from "zod";

/** Fields captured by the intake form (R1) and the import template (R2). Normalization happens server-side. */
export const seekerIntakeSchema = z
  .object({
    fullName: z.string().trim().min(1, "Name is required").max(200),
    email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    city: z.string().trim().min(1, "City is required").max(120),
    state: z.string().trim().max(60).optional().or(z.literal("")),
    countryCode: z.string().trim().length(2).toUpperCase().default("US"),
    howHeard: z.string().trim().max(200).optional().or(z.literal("")),
    firstSessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().or(z.literal("")),
    centerId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    mentorName: z.string().trim().max(200).optional().or(z.literal("")),
    mentorEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    /** Client-generated for offline idempotency. */
    clientMutationId: z.string().uuid(),
  })
  .refine((v) => Boolean(v.email) || Boolean(v.phone), { message: "Enter an email or a phone number", path: ["email"] })
  .refine((v) => v.countryCode !== "US" || Boolean(v.state), { message: "State is required for US seekers", path: ["state"] });

export type SeekerIntake = z.infer<typeof seekerIntakeSchema>;
