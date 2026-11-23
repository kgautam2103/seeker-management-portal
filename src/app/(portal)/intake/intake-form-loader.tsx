"use client";

import dynamic from "next/dynamic";
import type { IntakeOptions } from "@/modules/seekers/queries";

/**
 * The form depends on the device: today's date in its time zone, its locale's country names, its
 * offline storage and connection state. Rendering it only in the browser keeps the server's guess
 * of those from ever reaching the page (and avoids hydration mismatches).
 */
const IntakeForm = dynamic(() => import("./intake-form").then((m) => m.IntakeForm), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex max-w-lg flex-col gap-6" aria-busy="true">
      <h1 className="text-xl font-semibold">Add a seeker</h1>
      <div className="h-96 animate-pulse rounded-lg border border-zinc-200 bg-white" />
    </div>
  ),
});

export function IntakeFormLoader({ options }: { options: IntakeOptions }) {
  return <IntakeForm options={options} />;
}
