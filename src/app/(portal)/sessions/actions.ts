"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type StartSessionState = { error: string | null };

const startSchema = z.object({
  programId: z.guid("Choose a program"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
});

/**
 * Opens the session for a program on a date, or the one already open, and goes to its roster.
 * Needs a connection; marking attendance afterwards does not.
 */
export async function startSession(_prev: StartSessionState, formData: FormData): Promise<StartSessionState> {
  const parsed = startSchema.safeParse({ programId: formData.get("programId"), date: formData.get("date") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_session", {
    p_program_id: parsed.data.programId,
    p_date: parsed.data.date,
  });
  if (error) {
    if (error.code === "42501") return { error: "You can't start sessions for this program." };
    if (error.code === "22023") return { error: error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." };
    console.error("start_session failed", error.code, error.message);
    return { error: "Couldn't start the session. Try again." };
  }
  redirect(`/sessions/${String(data)}`);
}
