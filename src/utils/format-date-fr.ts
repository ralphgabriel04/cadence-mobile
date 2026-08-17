import { isoDayOfWeek, toDayNumber } from "./program-schedule";

/**
 * French date formatting, without `Intl`.
 *
 * Hermes only ships full `Intl` when the build enables it, and the exact output
 * of `toLocaleDateString` varies between engine versions and platforms. Since
 * these strings are user-visible French and appear in snapshots and assertions,
 * a small explicit table is both deterministic and testable.
 *
 * Québec French conventions: day and month names lowercase, no comma before the
 * year, `1er` for the first of the month.
 */

const DAYS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

const DAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"] as const;

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** Full day name for an ISODOW value, 1 = Monday. */
export function dayNameFr(isoDow: number): string {
  return DAYS[isoDow - 1] ?? "";
}

/** Single-letter day label for an ISODOW value, for the week strip. */
export function dayInitialFr(isoDow: number): string {
  return DAYS_SHORT[isoDow - 1] ?? "";
}

/** `"lundi 17 août"` — no year, for dates inside the current program. */
export function formatDayAndMonthFr(iso: string): string {
  const [, month, day] = parseParts(iso);
  const dayLabel = day === 1 ? "1er" : String(day);
  return `${dayNameFr(isoDayOfWeek(iso))} ${dayLabel} ${MONTHS[month - 1] ?? ""}`;
}

/** `"17 août 2026"` — with the year, for dates that may be far away. */
export function formatDateFr(iso: string): string {
  const [year, month, day] = parseParts(iso);
  const dayLabel = day === 1 ? "1er" : String(day);
  return `${dayLabel} ${MONTHS[month - 1] ?? ""} ${year}`;
}

/** `"17 – 23 août"`, collapsing the month when both ends share it. */
export function formatDateRangeFr(startISO: string, endISO: string): string {
  const [, startMonth, startDay] = parseParts(startISO);
  const [, endMonth, endDay] = parseParts(endISO);
  const startLabel = startDay === 1 ? "1er" : String(startDay);
  const endLabel = endDay === 1 ? "1er" : String(endDay);

  if (startMonth === endMonth) {
    return `${startLabel} – ${endLabel} ${MONTHS[endMonth - 1] ?? ""}`;
  }
  return `${startLabel} ${MONTHS[startMonth - 1] ?? ""} – ${endLabel} ${MONTHS[endMonth - 1] ?? ""}`;
}

/** `"55 min"` or `"1 h 25"`. */
export function formatDurationFr(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

function parseParts(iso: string): [number, number, number] {
  // Validates through toDayNumber, so a malformed value throws with a clear
  // message here rather than rendering "undefined août".
  toDayNumber(iso);
  const [y, m, d] = iso.split("-").map(Number);
  return [y ?? 0, m ?? 0, d ?? 0];
}
