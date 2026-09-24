import { getUserContext } from "@/lib/auth/context";

export const metadata = { title: "Dashboard" };

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  regional_coordinator: "Regional coordinator",
  volunteer_coordinator: "Volunteer coordinator",
  instructor: "Instructor",
};

export default async function DashboardPage() {
  const ctx = (await getUserContext())!;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-xl font-semibold">Welcome</h1>
        <p className="mt-1 text-sm text-zinc-600">Signed in as {ctx.email}.</p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-medium">Your roles</h2>
        {ctx.roles.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">
            Your account has no roles yet. Ask the steward to assign you to a center; until then nothing is visible.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {ctx.roles.map((r, i) => (
              <li key={i} className="flex justify-between py-2">
                <span>{ROLE_LABEL[r.role] ?? r.role}</span>
                <span className="text-zinc-600">{r.center?.name ?? r.region?.name ?? "All centers"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
        Phase 1 scaffold. Next slices: seeker intake (offline-first), session roster and attendance, historical import,
        Eventbrite backfill, center dashboard.
      </section>
    </div>
  );
}
