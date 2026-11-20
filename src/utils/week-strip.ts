import type { WeekDay, WeekDayState } from "@/types/today-screen";

import { dayNameFr } from "./format-date-fr";

// ============================================================================
// State of each day of the week strip (story 4.3).
//
// get_today_screen() says "upcoming" for any planned day without a log, past
// or future. The athlete needs to tell a day they MISSED from one still to
// come, so a planned day before today without a log becomes "missed" here.
// ============================================================================

export type StripState = WeekDayState | "missed";

export function stripState(day: WeekDay, todayDow: number): StripState {
  if (day.state === "upcoming" && day.dayOfWeek < todayDow) return "missed";
  return day.state;
}

const STATE_LABEL: Record<StripState, string> = {
  completed: "fait",
  started: "commencé",
  skipped: "passé",
  missed: "manqué",
  upcoming: "à venir",
  rest: "repos",
};

/** What the screen reader says for a day: « mardi, manqué ». */
export function dayAccessibilityLabel(day: WeekDay, todayDow: number): string {
  const state = stripState(day, todayDow);
  // eslint-disable-next-line security/detect-object-injection -- state is a typed union, not user input
  const label = STATE_LABEL[state];
  return `${dayNameFr(day.dayOfWeek)}${day.isToday ? " (aujourd'hui)" : ""}, ${label}`;
}
