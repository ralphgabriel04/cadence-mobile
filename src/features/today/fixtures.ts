/**
 * Deterministic fixtures for the "Today" screen's three real states.
 * Display text is French-Québécois; identifiers and dates are fixed so
 * snapshots and assertions never drift between test runs.
 */

import type { TodayViewState } from "./types";

export const readyFixture: TodayViewState = {
  status: "ready",
  localDate: "2026-08-11",
  athlete: { displayName: "Alexandre Tremblay" },
  todayWorkout: {
    id: "wk-2026-08-11",
    title: "Fractionné 6x800m",
    exerciseCount: 6,
    estimatedDurationMinutes: 55,
    coachName: "Coach Véronique",
    state: "scheduled",
  },
  weeklyCompliance: [
    { date: "2026-08-05", isToday: false, status: "completed" },
    { date: "2026-08-06", isToday: false, status: "completed" },
    { date: "2026-08-07", isToday: false, status: "missed" },
    { date: "2026-08-08", isToday: false, status: "completed" },
    { date: "2026-08-09", isToday: false, status: "planned" },
    { date: "2026-08-10", isToday: false, status: "completed" },
    { date: "2026-08-11", isToday: true, status: "planned" },
  ],
  lastSession: {
    id: "wk-2026-08-10",
    title: "Sortie longue 14 km",
    completedAt: "2026-08-10T09:32:00-04:00",
  },
  personalRecords: [
    { id: "pr-5k", label: "5 km", value: "19:42", achievedAt: "2026-07-28" },
    { id: "pr-10k", label: "10 km", value: "41:15", achievedAt: "2026-06-14" },
  ],
};

export const emptyFixture: TodayViewState = { status: "empty" };

export const errorFixture: TodayViewState = {
  status: "error",
  message: "Impossible de charger les données d'aujourd'hui. Réessaie plus tard.",
};
