/**
 * Date arithmetic for placing a program's sessions on a calendar.
 *
 * All arithmetic is done on whole days via UTC, never on local `Date` objects.
 * A date-only value has no time component, so using local time would drag in
 * daylight-saving transitions: adding "7 days" across a DST boundary with
 * `setDate` lands an hour off, and once an hour off, `getDate()` can cross
 * midnight and report the wrong day. UTC has no such transitions.
 *
 * Week numbering matches `program_week_number()` in migration 006: week 1
 * starts on the assignment's `start_date`, NOT on the Monday of that calendar
 * week. So an assignment starting on a Wednesday has week 1 running Wednesday
 * to Tuesday. Both sides must agree or the home screen and the plan view will
 * disagree about which week the athlete is in.
 */

const MS_PER_DAY = 86_400_000;

/** Days since the epoch for a `yyyy-mm-dd` value. */
export function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined || Number.isNaN(y + m + d)) {
    throw new Error(`Not a yyyy-mm-dd date: ${iso}`);
  }
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** Inverse of {@link toDayNumber}. */
export function fromDayNumber(days: number): string {
  const date = new Date(days * MS_PER_DAY);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISODOW of a `yyyy-mm-dd` value: 1 = Monday .. 7 = Sunday. */
export function isoDayOfWeek(iso: string): number {
  const jsDay = new Date(toDayNumber(iso) * MS_PER_DAY).getUTCDay(); // 0 = Sunday
  return ((jsDay + 6) % 7) + 1;
}

/**
 * The calendar date a session falls on.
 *
 * `weekNumber` is 1-based. `dayOfWeek` is ISODOW. Because week 1 is anchored on
 * `startDate` rather than on a Monday, the day is found by walking FORWARD from
 * the week's first day to the next matching weekday -- so a Monday session in a
 * week that starts on Wednesday lands six days in, not six days earlier.
 *
 * Returns null when the session carries no day, which the schema allows.
 */
export function sessionDate(
  startDateISO: string,
  weekNumber: number,
  dayOfWeek: number | null,
): string | null {
  if (dayOfWeek === null) return null;

  const weekStart = toDayNumber(startDateISO) + (weekNumber - 1) * 7;
  const weekStartDow = isoDayOfWeek(fromDayNumber(weekStart));
  const offset = (dayOfWeek - weekStartDow + 7) % 7;
  return fromDayNumber(weekStart + offset);
}

/** How many weeks a program spans, given its sessions. */
export function weekCount(
  durationWeeks: number | null,
  sessionWeekNumbers: readonly (number | null)[],
): number {
  const fromSessions = sessionWeekNumbers.reduce<number>(
    (max, w) => (w !== null && w > max ? w : max),
    0,
  );
  // A declared duration wins when it is longer: a 12-week program that only has
  // week 1 written out is still 12 weeks long, and showing one week would hide
  // that the rest is empty.
  return Math.max(durationWeeks ?? 0, fromSessions, 1);
}

export type SessionOccurrenceState =
  /** A log for this occurrence has status `completed`. */
  | "completed"
  /** A log for this occurrence has status `skipped`. */
  | "skipped"
  /** The date has passed with no log. */
  | "missed"
  /** Scheduled for today. */
  | "today"
  /** Still ahead. */
  | "upcoming";

/**
 * State of one scheduled occurrence.
 *
 * `logDates` are the dates on which the athlete logged this session, with the
 * status of each. Matching is by DATE rather than by session id because a
 * session with `week_number = NULL` repeats every week: matching on the id alone
 * would mark every week's occurrence complete as soon as one of them was done.
 */
export function occurrenceState(args: {
  scheduledDate: string | null;
  todayDate: string;
  logs: readonly { date: string; status: "in_progress" | "completed" | "skipped" }[];
}): SessionOccurrenceState {
  const { scheduledDate, todayDate, logs } = args;

  if (scheduledDate !== null) {
    const onThatDay = logs.filter((l) => l.date === scheduledDate);
    if (onThatDay.some((l) => l.status === "completed")) return "completed";
    if (onThatDay.some((l) => l.status === "skipped")) return "skipped";
  }

  // A session with no day cannot be missed -- there is no date it should have
  // happened on -- so it stays upcoming until it is logged.
  if (scheduledDate === null) return "upcoming";

  const scheduled = toDayNumber(scheduledDate);
  const today = toDayNumber(todayDate);
  if (scheduled < today) return "missed";
  if (scheduled === today) return "today";
  return "upcoming";
}
