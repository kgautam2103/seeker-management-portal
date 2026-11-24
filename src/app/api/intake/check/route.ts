import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/normalize/phone";
import { toContactCheck } from "@/modules/seekers/intake";

const checkSchema = z.object({
  email: z.string().trim().toLowerCase().max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().default("US"),
});

/** Duplicate warning while the volunteer types (R1). Online only; the server dedupes again at save. */
export async function POST(request: Request) {
  // JSON only: a cross-site HTML form cannot send this content type without a CORS preflight.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Expected application/json" }, { status: 415 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "signed out" }, { status: 401 });

  const parsed = checkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ match: "none" });
  const { email, phone, countryCode } = parsed.data;
  const emailValid = email && z.string().email().safeParse(email).success ? email : null;
  const phoneE164 = normalizePhone(phone, countryCode);
  if (!emailValid && !phoneE164) return Response.json({ match: "none" });

  const { data, error } = await supabase.rpc("intake_contact_check", { p_email: emailValid, p_phone: phoneE164 });
  if (error) {
    if (error.code === "42501") return Response.json({ match: "none" });
    return Response.json({ error: "check failed" }, { status: 500 });
  }
  return Response.json(toContactCheck(data as Record<string, unknown>));
}
