"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { REMARK_TAGS, remarkSchema, type AttendanceStatus, type Roster, type SeekerMatch } from "@/modules/attendance/schema";
import { mergeRoster, rosterCounts, type RosterRow } from "@/modules/attendance/roster";
import { offlineDb } from "@/offline/db";
import { drainOutbox, enqueueMark, enqueueRemark, removeItem } from "@/offline/outbox";
import { useOutbox } from "@/offline/use-outbox";

const REFRESH_MS = 30_000;

export function RosterView({ initial }: { initial: Roster }) {
  const sessionId = initial.session.id;
  const [roster, setRoster] = useState<Roster>(initial);
  const [filter, setFilter] = useState("");
  const { items, online } = useOutbox();

  const keep = useCallback(
    (next: Roster) => {
      setRoster((cur) => (next.fetchedAt > cur.fetchedAt ? next : cur));
      void offlineDb.rosters.get(sessionId).then((cached) => {
        if (!cached || cached.fetchedAt < next.fetchedAt) return offlineDb.rosters.put({ ...next, sessionId });
      });
    },
    [sessionId],
  );

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/roster`, { credentials: "same-origin", cache: "no-store" });
      if (res.ok) keep((await res.json()) as Roster);
    } catch {
      // offline: the cached copy stays
    }
  }, [keep, sessionId]);

  // The page may come from the service worker's cache: prefer whichever copy is newest.
  useEffect(() => {
    void offlineDb.rosters.get(sessionId).then((cached) => {
      if (cached && cached.fetchedAt > initial.fetchedAt) keep(cached);
      else return offlineDb.rosters.put({ ...initial, sessionId });
    });
  }, [initial, keep, sessionId]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(tick, REFRESH_MS);
    window.addEventListener("online", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", tick);
    };
  }, [refresh]);

  const rows = useMemo(() => mergeRoster(roster, items), [roster, items]);
  const counts = rosterCounts(rows);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? rows.filter((r) => r.fullName.toLowerCase().includes(q)) : rows;
  }, [rows, filter]);

  // Everything this device still has to send for this session: taps and notes.
  const unsent = items.filter(
    (i) =>
      i.status === "pending" &&
      ((i.kind === "attendance" && i.payload.sessionId === sessionId) || (i.kind === "remark" && i.sessionId === sessionId)),
  );
  const stuck = unsent.some((i) => i.attempts > 0);
  const syncLine = !online
    ? unsent.length > 0
      ? `Offline · ${unsent.length} saved on this device`
      : "Offline · taps are saved on this device"
    : unsent.length === 0
      ? "All saved"
      : stuck
        ? `Can't reach the server · ${unsent.length} saved on this device`
        : "Sending…";

  const cancelled = roster.session.status === "cancelled";

  async function tap(seekerId: string, fullName: string, status: AttendanceStatus) {
    await enqueueMark(
      { clientMutationId: crypto.randomUUID(), sessionId, seekerId, status, markedAt: new Date().toISOString() },
      fullName,
    );
    void drainOutbox({ force: true }).then(refresh);
  }

  async function note(seekerId: string, fullName: string, body: string, tags: string[]) {
    await enqueueRemark({ clientMutationId: crypto.randomUUID(), sessionId, seekerId, body, tags }, fullName);
    void drainOutbox({ force: true }).then(refresh);
  }

  const s = roster.session;
  const when = new Date(s.startsAt).toLocaleString("en-US", {
    timeZone: s.timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div>
        <Link href="/sessions" className="text-sm text-indigo-700 underline">
          All sessions
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{s.programName}</h1>
        <p className="text-sm text-zinc-600">
          {when} · {s.centerName}
        </p>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm">
        <span>
          <strong>{counts.present}</strong> present · {counts.absent} absent · {counts.unmarked} not marked
        </span>
        <span className={online && !stuck ? "text-zinc-600" : "font-medium text-amber-800"} role="status">
          {syncLine}
        </span>
      </div>

      {cancelled ? (
        <p role="alert" className="rounded-md border border-zinc-300 bg-zinc-100 p-3 text-sm">
          This session was cancelled, so attendance can&apos;t be marked.
        </p>
      ) : null}

      {rows.length > 8 ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Find someone
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base"
            autoComplete="off"
          />
        </label>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-700">
          Nobody is registered for this program yet. Add people below as they arrive.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {shown.map((row) => (
            <RosterItem
              key={row.seekerId}
              row={row}
              disabled={cancelled}
              onTap={(status) => void tap(row.seekerId, row.fullName, status)}
              onNote={(body, tags) => note(row.seekerId, row.fullName, body, tags)}
            />
          ))}
          {shown.length === 0 ? <li className="p-3 text-sm text-zinc-600">No one matches “{filter}”.</li> : null}
        </ul>
      )}

      {!cancelled ? (
        <WalkIn
          online={online}
          onRoster={new Set(rows.map((r) => r.seekerId))}
          onMark={(m) => void tap(m.id, m.fullName, "present")}
          intakeHref={`/intake?program=${s.programId}`}
        />
      ) : null}
    </div>
  );
}

function RosterItem({
  row,
  disabled,
  onTap,
  onNote,
}: {
  row: RosterRow;
  disabled: boolean;
  onTap: (status: AttendanceStatus) => void;
  onNote: (body: string, tags: string[]) => Promise<void>;
}) {
  const [noting, setNoting] = useState(false);

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{row.fullName}</p>
          <p className="flex flex-wrap gap-x-2 text-xs text-zinc-600">
            {row.isNew === true ? <span className="font-medium text-emerald-800">New</span> : null}
            {row.isNew === false ? <span>Returning</span> : null}
            {!row.registered ? <span>Walk-in</span> : null}
            {row.syncing ? <span className="text-amber-800">Saved on device</span> : null}
            {row.remarkCount > 0 ? <span>{row.remarkCount === 1 ? "1 note" : `${row.remarkCount} notes`}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-1" role="group" aria-label={`Attendance for ${row.fullName}`}>
          <MarkButton label="Present" pressed={row.status === "present"} disabled={disabled} onClick={() => onTap("present")} />
          <MarkButton label="Absent" pressed={row.status === "absent"} disabled={disabled} onClick={() => onTap("absent")} />
        </div>
      </div>

      {row.problem ? (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-md bg-red-50 p-2 text-sm text-red-800">
          <span>Not saved: {row.problem}</span>
          {row.problemItemId ? (
            <button type="button" className="shrink-0 underline" onClick={() => void removeItem(row.problemItemId!)}>
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}

      {noting ? (
        <NoteEditor
          name={row.fullName}
          onCancel={() => setNoting(false)}
          onSave={async (body, tags) => {
            await onNote(body, tags);
            setNoting(false);
          }}
        />
      ) : (
        <button type="button" className="self-start text-sm text-indigo-700 underline" onClick={() => setNoting(true)}>
          Add a note
        </button>
      )}
    </li>
  );
}

function MarkButton({ label, pressed, disabled, onClick }: { label: string; pressed: boolean; disabled: boolean; onClick: () => void }) {
  const on = label === "Present" ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-700 bg-zinc-700 text-white";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 min-w-20 rounded-md border px-3 text-sm font-medium disabled:opacity-50 ${
        pressed ? on : "border-zinc-300 bg-white text-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}

function NoteEditor({
  name,
  onSave,
  onCancel,
}: {
  name: string;
  onSave: (body: string, tags: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = remarkSchema.shape.body.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the note");
      return;
    }
    await onSave(parsed.data, tags);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-zinc-50 p-2">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Note about {name}
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setError(null);
          }}
          rows={3}
          maxLength={2000}
          autoFocus
          aria-invalid={error ? true : undefined}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-1" role="group" aria-label="Tags">
        {REMARK_TAGS.map((t) => {
          const on = tags.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => setTags((cur) => (on ? cur.filter((x) => x !== t) : [...cur, t]))}
              className={`rounded-full border px-3 py-1 text-xs ${on ? "border-indigo-700 bg-indigo-700 text-white" : "border-zinc-300 bg-white"}`}
            >
              {t}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-zinc-600">Only people at your center see notes. They never go into messages.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => void save()} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">
          Save note
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Someone not on the roster: find them by name (needs a connection), or add them as a new seeker. */
function WalkIn({
  online,
  onRoster,
  onMark,
  intakeHref,
}: {
  online: boolean;
  onRoster: Set<string>;
  onMark: (m: SeekerMatch) => void;
  intakeHref: string;
}) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<SeekerMatch[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch("/api/seekers/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q }),
        credentials: "same-origin",
      });
      setMatches(res.ok ? ((await res.json()) as { matches: SeekerMatch[] }).matches : []);
    } catch {
      setMatches(null);
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
      <h2 className="font-semibold">Someone not on the list?</h2>
      {online ? (
        <form onSubmit={(e) => void search(e)} className="flex gap-2">
          <label className="sr-only" htmlFor="walkin-search">
            Search by name
          </label>
          <input
            id="walkin-search"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setMatches(null);
            }}
            placeholder="Search by name"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-base"
          />
          <button type="submit" disabled={searching} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium">
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-700">Searching needs a connection. Someone new can still be added as a seeker.</p>
      )}
      {matches ? (
        matches.length === 0 ? (
          <p className="text-sm text-zinc-700">No one by that name at your center.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{m.fullName}</span>
                  {m.city ? <span className="text-xs text-zinc-600">{m.city}</span> : null}
                </span>
                {onRoster.has(m.id) ? (
                  <span className="text-sm text-zinc-600">On the list</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onMark(m);
                      setMatches(null);
                      setQ("");
                    }}
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Mark present
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}
      <p className="text-sm text-zinc-700">
        <a href={intakeHref} className="text-indigo-700 underline">
          Add someone new
        </a>{" "}
        — they join this program&apos;s list once saved; then mark them present here.
      </p>
    </section>
  );
}
