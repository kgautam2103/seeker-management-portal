import { z } from "zod";

export const attendanceStatus = z.enum(["present", "absent"]);
export type AttendanceStatus = z.infer<typeof attendanceStatus>;

/** One tap on the roster (R5). `markedAt` is the device's time of the tap: the later tap wins. */
export const markSchema = z.object({
  clientMutationId: z.guid(),
  sessionId: z.guid(),
  seekerId: z.guid(),
  status: attendanceStatus,
  markedAt: z.iso.datetime({ offset: true }),
});
export type MarkInput = z.infer<typeof markSchema>;

/** Tags offered on the roster. Remarks accept any short tag; these keep the common ones consistent. */
export const REMARK_TAGS = ["follow-up", "first time", "interested in programs", "asked a question"] as const;

/** A note about a seeker at a session. Internal only: never in messages, exports or AI prompts. */
export const remarkSchema = z.object({
  clientMutationId: z.guid(),
  sessionId: z.guid().optional(),
  seekerId: z.guid(),
  body: z.string().trim().min(1, "Write a note first").max(2000, "Keep it under 2000 characters"),
  tags: z.array(z.string().trim().max(40)).max(10).default([]),
});
export type RemarkInput = z.input<typeof remarkSchema>;

export type MarkResult = {
  outcome: "recorded" | "already_applied" | "superseded";
  status: AttendanceStatus;
  firstVisit: boolean;
};
export type RemarkResult = { outcome: "created" | "already_applied"; remarkId: string };

export type RosterEntry = {
  seekerId: string;
  fullName: string;
  /** Registered for the program; false for walk-ins. */
  registered: boolean;
  status: AttendanceStatus | null;
  markedAt: string | null;
  /** No earlier attendance or recorded first session. Null when not known yet (a walk-in added offline). */
  isNew: boolean | null;
  remarkCount: number;
};

export type RosterSession = {
  id: string;
  programId: string;
  programName: string;
  centerId: string;
  centerName: string;
  timezone: string;
  startsAt: string;
  status: "scheduled" | "held" | "cancelled";
};

export type Roster = { session: RosterSession; entries: RosterEntry[]; fetchedAt: number };

export function toMarkResult(raw: Record<string, unknown>): MarkResult {
  const outcome = raw.outcome;
  if (outcome !== "recorded" && outcome !== "already_applied" && outcome !== "superseded") {
    throw new Error(`Unexpected attendance outcome: ${String(outcome)}`);
  }
  return { outcome, status: attendanceStatus.parse(raw.status), firstVisit: raw.first_visit === true };
}

export function toRemarkResult(raw: Record<string, unknown>): RemarkResult {
  const outcome = raw.outcome;
  if (outcome !== "created" && outcome !== "already_applied") throw new Error(`Unexpected remark outcome: ${String(outcome)}`);
  return { outcome, remarkId: String(raw.remark_id) };
}

export function toRosterEntry(row: Record<string, unknown>): RosterEntry {
  return {
    seekerId: String(row.seeker_id),
    fullName: String(row.full_name),
    registered: row.registered === true,
    status: row.status == null ? null : attendanceStatus.parse(row.status),
    markedAt: row.marked_at == null ? null : String(row.marked_at),
    isNew: row.is_new === true,
    remarkCount: Number(row.remark_count ?? 0),
  };
}

/** A walk-in search result: name and city only. */
export type SeekerMatch = { id: string; fullName: string; city: string | null };
