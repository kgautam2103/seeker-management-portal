import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "regional_coordinator" | "volunteer_coordinator" | "instructor";

export type RoleAssignment = {
  role: Role;
  center: { id: string; name: string } | null;
  region: { id: string; name: string } | null;
};

export type UserContext = {
  userId: string;
  email: string | null;
  roles: RoleAssignment[];
  isAdmin: boolean;
  centerIds: string[];
};

/** Who is signed in and what they may see. Reads role_assignment through the user's own session. */
export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("role_assignment")
    .select("role, center:center(id, name), region:region(id, name)")
    .eq("user_id", user.id);
  if (error) throw new Error(`Could not load roles: ${error.message}`);

  const roles = (data ?? []) as unknown as RoleAssignment[];
  return {
    userId: user.id,
    email: user.email ?? null,
    roles,
    isAdmin: roles.some((r) => r.role === "admin"),
    centerIds: roles.flatMap((r) => (r.center ? [r.center.id] : [])),
  };
}
