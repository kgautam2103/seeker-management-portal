import Link from "next/link";
import { getRecentSessions, type SessionSummary } from "@/modules/attendance/queries";
import { getIntakeOptions } from "@/modules/seekers/queries";
import { StartSessionForm, type StartableProgram } from "./start-session-form";
import { WarmRosters } from "./warm-rosters";

export const metadata = { title: "Sessions" };

const localDate = (iso: string | Date, timeZone: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone });

function when(s: SessionSummary): string {
  return new Date(s.startsAt).toLocaleString("en-US", {
    timeZone: s.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SessionsPage() {
  const [sessions, options] = await Promise.all([getRecentSessions(), getIntakeOptions()]);

  if (options.centers.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        <h1 className="text-lg font-semibold">Sessions</h1>
        <p className="mt-2">You aren&apos;t assigned to a center yet. Ask the steward to assign you.</p>
      </section>
    );
  }

  // "Today" is the center's today, not the server's.
  const centers = new Map(options.centers.map((c) => [c.id, c]));
  const programs: StartableProgram[] = options.programs.map((p) => ({
    id: p.id,
    name: p.name,
    centerName: centers.get(p.centerId)?.name ?? "",
    today: localDate(new Date(), centers.get(p.centerId)?.timezone ?? "UTC"),
  }));

  const now = new Date();
  const today = sessions.filter((s) => localDate(s.startsAt, s.timezone) === localDate(now, s.timezone));
  const upcoming = sessions.filter((s) => new Date(s.startsAt) > now && !today.includes(s)).reverse();
  const earlier = sessions.filter((s) => new Date(s.startsAt) <= now && !today.includes(s));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="text-xl font-semibold">Sessions</h1>
      <WarmRosters sessionIds={[...today, ...upcoming.slice(0, 3)].filter((s) => s.status !== "cancelled").map((s) => s.id)} />

      {programs.length > 0 ? (
        <StartSessionForm programs={programs} showCenter={options.centers.length > 1} />
      ) : (
        <p className="text-sm text-zinc-700">There are no active programs at your center yet.</p>
      )}

      <SessionGroup title="Today" sessions={today} empty="No session today yet. Start one above." />
      {upcoming.length > 0 ? <SessionGroup title="Coming up" sessions={upcoming} /> : null}
      {earlier.length > 0 ? <SessionGroup title="Last two weeks" sessions={earlier} /> : null}

      <p className="text-xs text-zinc-600">
        Rosters for today open with no connection once you&apos;ve loaded this page with one.{" "}
        <Link href="/intake" className="underline">
          Add a seeker
        </Link>
      </p>
    </div>
  );
}

function SessionGroup({ title, sessions, empty }: { title: string; sessions: SessionSummary[]; empty?: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">{title}</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-700">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.id}>
              {/* A full page load, so the service worker's cached copy is used when offline. */}
              <a
                href={`/sessions/${s.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:border-indigo-300"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{s.programName}</span>
                  <span className="text-sm text-zinc-600">
                    {when(s)} · {s.centerName}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  {s.status === "cancelled" ? (
                    <span className="text-zinc-500">Cancelled</span>
                  ) : (
                    <>
                      <span className="font-medium">{s.present}</span> present
                      <span className="block text-xs text-zinc-500">{s.registered} registered</span>
                    </>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
