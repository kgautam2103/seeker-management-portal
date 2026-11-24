"use client";

import { useActionState } from "react";
import { startSession, type StartSessionState } from "./actions";

export type StartableProgram = { id: string; name: string; centerName: string; today: string };

const inputClass = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:outline-2 focus:outline-indigo-600";

export function StartSessionForm({ programs, showCenter }: { programs: StartableProgram[]; showCenter: boolean }) {
  const [state, action, pending] = useActionState<StartSessionState, FormData>(startSession, { error: null });

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="font-semibold">Start a session</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Program
          <select name="programId" required className={inputClass} defaultValue={programs[0]?.id}>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {showCenter ? `${p.name} (${p.centerName})` : p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Date
          <input type="date" name="date" required defaultValue={programs[0]?.today} className={inputClass} />
        </label>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Opening…" : "Open roster"}
        </button>
      </div>
      <p className="text-xs text-zinc-600">If that program already has a session on that date, its roster opens instead.</p>
    </form>
  );
}
