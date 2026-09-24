"use client";

import { useActionState } from "react";
import { signInWithEmail, signInWithGoogle, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInWithEmail, {});

  if (state.ok) {
    return (
      <p className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">
        Check <strong>{state.sentTo}</strong> for a sign-in link. It expires in an hour.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            inputMode="email"
            className="rounded-md border border-zinc-300 px-3 py-2 text-base"
          />
        </label>
        {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="w-full rounded-md border border-zinc-300 px-4 py-2 font-medium">
          Continue with Google
        </button>
      </form>
    </div>
  );
}
