"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ISO_CODES } from "@/lib/normalize/country";
import { US_STATES } from "@/lib/normalize/us-state";
import { fieldErrorsOf, seekerIntakeSchema, type ContactCheck, type FieldErrors } from "@/modules/seekers/schema";
import type { IntakeOptions } from "@/modules/seekers/queries";
import type { OutboxItem } from "@/offline/db";
import { drainOutbox, enqueueSeeker, removeItem } from "@/offline/outbox";
import { useOutbox } from "@/offline/use-outbox";

type FormState = {
  clientMutationId: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  countryCode: string;
  howHeard: string;
  firstSessionDate: string;
  centerId: string;
  programId: string;
};

const HOW_HEARD = ["Friend or family", "Eventbrite", "Meetup", "Flyer or poster", "Social media", "Library", "Walked in"];

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the device's time zone

function blankForm(options: IntakeOptions, keep?: Partial<FormState>): FormState {
  const center = options.centers.find((c) => c.id === keep?.centerId) ?? options.centers[0];
  return {
    clientMutationId: crypto.randomUUID(),
    fullName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    countryCode: center?.countryCode ?? "US",
    howHeard: "",
    // Volunteers usually enter several people from the same session: keep where and when.
    firstSessionDate: keep?.firstSessionDate ?? today(),
    centerId: center?.id ?? "",
    programId: keep?.programId ?? "",
  };
}

const countryNames = (() => {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return ISO_CODES.map((code) => ({ code, name: names.of(code) ?? code }))
    .filter((c) => c.code !== "US")
    .sort((a, b) => a.name.localeCompare(b.name));
})();

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base aria-[invalid=true]:border-red-600 focus:outline-2 focus:outline-indigo-600";

export function IntakeForm({ options }: { options: IntakeOptions }) {
  const [form, setForm] = useState<FormState>(() => blankForm(options));
  const [errors, setErrors] = useState<FieldErrors & { form?: string }>({});
  const [check, setCheck] = useState<ContactCheck | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const { items, online, ready } = useOutbox();

  const programs = useMemo(
    () => options.programs.filter((p) => p.centerId === form.centerId),
    [options.programs, form.centerId],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof FieldErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
    if (key === "email" || key === "phone" || key === "countryCode") setCheck(null); // re-checked on blur
  };

  // Duplicate warning: same contact already queued on this device, or on file (online only).
  const queuedTwin = useMemo(() => {
    const email = form.email.trim().toLowerCase();
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (!email && phoneDigits.length < 7) return null;
    return items.find(
      (i) =>
        i.id !== form.clientMutationId &&
        i.payload &&
        ((email && i.payload.email?.trim().toLowerCase() === email) ||
          (phoneDigits.length >= 7 && i.payload.phone?.replace(/\D/g, "").endsWith(phoneDigits.slice(-10)))),
    );
  }, [items, form.email, form.phone, form.clientMutationId]);

  const checkAbort = useRef<AbortController | null>(null);
  async function runContactCheck() {
    if (!navigator.onLine || (!form.email.trim() && !form.phone.trim())) {
      setCheck(null);
      return;
    }
    checkAbort.current?.abort();
    const ctrl = new AbortController();
    checkAbort.current = ctrl;
    try {
      const res = await fetch("/api/intake/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.email, phone: form.phone, countryCode: form.countryCode }),
        signal: ctrl.signal,
      });
      if (res.ok) setCheck((await res.json()) as ContactCheck);
    } catch {
      // Offline or aborted: the server dedupes again when the entry syncs.
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = seekerIntakeSchema.safeParse(form);
    if (!parsed.success) {
      const fe = fieldErrorsOf(parsed.error);
      setErrors(fe);
      document.getElementById(`f-${Object.keys(fe)[0]}`)?.focus();
      return;
    }
    try {
      await enqueueSeeker(form);
    } catch {
      setErrors({ form: "This device couldn't save the entry (storage may be full or blocked). Nothing was saved." });
      return;
    }
    setFlash(`${form.fullName.trim()} saved${online ? "" : " on this device. It will be sent when you're back online"}.`);
    setErrors({});
    setCheck(null);
    setForm(blankForm(options, form));
    nameRef.current?.focus();
    void drainOutbox({ force: true });
  }

  function editItem(item: OutboxItem) {
    if (!item.payload) return;
    const p = item.payload;
    setForm({
      ...blankForm(options, { centerId: p.centerId }),
      clientMutationId: item.id, // same id: saving again replaces this entry
      fullName: p.fullName ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
      countryCode: p.countryCode ?? "US",
      howHeard: p.howHeard ?? "",
      firstSessionDate: p.firstSessionDate ?? "",
      programId: p.programId ?? "",
    });
    setErrors({ ...(item.fieldErrors ?? {}), form: item.lastError });
    setFlash(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    nameRef.current?.focus();
  }

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const isUS = form.countryCode === "US";
  const field = (key: keyof FieldErrors) => ({
    id: `f-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `e-${key}` : undefined,
  });
  const err = (key: keyof FieldErrors) =>
    errors[key] ? (
      <span id={`e-${key}`} className="text-sm text-red-700">
        {errors[key]}
      </span>
    ) : null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">Add a seeker</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${online ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
        >
          {online ? "Online" : "Offline — entries are kept on this device"}
        </span>
      </div>

      {flash ? (
        <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {flash}
        </p>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
        {errors.form ? (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {errors.form}
          </p>
        ) : null}

        <label className="flex flex-col gap-1 text-sm font-medium">
          Full name
          <input
            ref={nameRef}
            {...field("fullName")}
            autoComplete="off"
            autoCapitalize="words"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            className={inputClass}
          />
          {err("fullName")}
        </label>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm text-zinc-600">Email or phone — at least one</legend>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email
            <input
              {...field("email")}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              onBlur={runContactCheck}
              className={inputClass}
            />
            {err("email")}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Phone
            <input
              {...field("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              onBlur={runContactCheck}
              className={inputClass}
            />
            {err("phone")}
          </label>
        </fieldset>

        {queuedTwin ? (
          <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            You already entered <strong>{queuedTwin.label}</strong> with this contact on this device.
          </p>
        ) : check?.match === "visible" ? (
          <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Already on file: <strong>{check.fullName}</strong>
            {check.centerName ? ` (${check.centerName})` : ""}, same {check.matchedOn}. Saving will use that record
            (filling in anything it&apos;s missing) instead of adding a new one.
          </p>
        ) : check?.match === "other_center" ? (
          <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            This {check.matchedOn} is already on file with another center. Saving won&apos;t add a new record; it&apos;s
            noted for an admin.
          </p>
        ) : null}

        <label className="flex flex-col gap-1 text-sm font-medium">
          City
          <input
            {...field("city")}
            autoComplete="off"
            autoCapitalize="words"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            className={inputClass}
          />
          {err("city")}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {isUS ? "State" : "State / region"}
            {isUS ? (
              <select {...field("state")} value={form.state} onChange={(e) => set("state", e.target.value)} className={inputClass}>
                <option value="">Choose…</option>
                {Object.entries(US_STATES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input {...field("state")} value={form.state} onChange={(e) => set("state", e.target.value)} className={inputClass} />
            )}
            {err("state")}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Country
            <select
              {...field("countryCode")}
              value={form.countryCode}
              onChange={(e) => {
                set("countryCode", e.target.value);
                set("state", "");
              }}
              className={inputClass}
            >
              <option value="US">United States</option>
              {countryNames.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          <span>
            How did they hear about us? <span className="font-normal text-zinc-500">(optional)</span>
          </span>
          <input
            {...field("howHeard")}
            list="how-heard-options"
            autoComplete="off"
            value={form.howHeard}
            onChange={(e) => set("howHeard", e.target.value)}
            className={inputClass}
          />
          <datalist id="how-heard-options">
            {HOW_HEARD.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            First session
            <input
              {...field("firstSessionDate")}
              type="date"
              value={form.firstSessionDate}
              max={today()}
              onChange={(e) => set("firstSessionDate", e.target.value)}
              className={inputClass}
            />
            {err("firstSessionDate")}
          </label>
          {options.centers.length > 1 ? (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Center
              <select
                {...field("centerId")}
                value={form.centerId}
                onChange={(e) => {
                  const c = options.centers.find((x) => x.id === e.target.value);
                  setForm((f) => ({ ...f, centerId: e.target.value, programId: "", countryCode: c?.countryCode ?? f.countryCode }));
                }}
                className={inputClass}
              >
                {options.centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {err("centerId")}
            </label>
          ) : (
            <div className="flex flex-col gap-1 text-sm font-medium">
              Center
              <span className="py-2 font-normal">{options.centers[0].name}</span>
            </div>
          )}
        </div>

        {programs.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>
              Program <span className="font-normal text-zinc-500">(optional)</span>
            </span>
            <select value={form.programId} onChange={(e) => set("programId", e.target.value)} className={inputClass}>
              <option value="">Not sure / none</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button type="submit" className="mt-1 rounded-md bg-indigo-600 px-4 py-3 text-base font-medium text-white">
          Save seeker
        </button>
      </form>

      <RecentEntries items={items} ready={ready} online={online} onEdit={editItem} />
    </div>
  );
}

function RecentEntries({
  items,
  ready,
  online,
  onEdit,
}: {
  items: OutboxItem[];
  ready: boolean;
  online: boolean;
  onEdit: (item: OutboxItem) => void;
}) {
  if (!ready || items.length === 0) return null;
  const waiting = items.filter((i) => i.status === "pending").length;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">Entered on this device</h2>
        {waiting > 0 ? (
          <button type="button" onClick={() => void drainOutbox({ force: true })} className="text-sm text-indigo-700 underline">
            {online ? `Send ${waiting} now` : `${waiting} waiting for connection`}
          </button>
        ) : null}
      </div>
      <ul className="mt-2 divide-y divide-zinc-100 text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{item.label}</span>
              <StatusBadge item={item} />
            </div>
            <StatusDetail item={item} />
            {item.status === "needs_attention" ? (
              <div className="flex gap-4">
                <button type="button" onClick={() => onEdit(item)} className="text-indigo-700 underline">
                  Fix and resend
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Discard the entry for ${item.label}? It hasn't reached the server.`)) void removeItem(item.id);
                  }}
                  className="text-zinc-600 underline"
                >
                  Discard
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({ item }: { item: OutboxItem }) {
  const [label, cls] =
    item.status === "pending"
      ? ["Waiting to send", "bg-zinc-100 text-zinc-700"]
      : item.status === "needs_attention"
        ? ["Needs attention", "bg-red-50 text-red-800"]
        : item.result?.outcome === "matched_other_center"
          ? ["At another center", "bg-amber-50 text-amber-900"]
          : item.result?.outcome === "matched"
            ? ["Matched existing", "bg-sky-50 text-sky-900"]
            : ["Added", "bg-emerald-50 text-emerald-800"];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function StatusDetail({ item }: { item: OutboxItem }) {
  if (item.status === "pending") {
    return item.lastError ? <span className="text-zinc-600">{item.lastError}</span> : null;
  }
  if (item.status === "needs_attention") return <span className="text-red-800">{item.lastError}</span>;
  const r = item.result;
  if (!r) return null;
  if (r.outcome === "created" && r.possibleDuplicates > 0) {
    return (
      <span className="text-zinc-600">
        Looks similar to {r.possibleDuplicates} existing {r.possibleDuplicates === 1 ? "seeker" : "seekers"}; an admin
        will review.
      </span>
    );
  }
  if (r.outcome === "matched") {
    return <span className="text-zinc-600">Same {r.matchedOn} as {r.fullName}; used that record.</span>;
  }
  if (r.outcome === "matched_other_center") {
    return (
      <span className="text-zinc-600">
        Same {r.matchedOn} is on file with another center, so no new record was added. It&apos;s noted for an admin.
      </span>
    );
  }
  return null;
}
