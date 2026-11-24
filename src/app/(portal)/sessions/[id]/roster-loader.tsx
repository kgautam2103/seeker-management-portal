"use client";

import dynamic from "next/dynamic";
import type { Roster } from "@/modules/attendance/schema";

/** Browser only: the roster reads this device's saved taps and cached copy (IndexedDB). */
const RosterView = dynamic(() => import("./roster-view").then((m) => m.RosterView), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex max-w-lg flex-col gap-4" aria-busy="true">
      <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-200" />
      <div className="h-96 animate-pulse rounded-lg border border-zinc-200 bg-white" />
    </div>
  ),
});

export function RosterLoader({ initial }: { initial: Roster }) {
  return <RosterView initial={initial} />;
}
