/**
 * Local, strictly-typed data contract for the athlete's "Today" screen.
 * Built before the Supabase service exists so UI work can start in parallel
 * (issue #101, split of #85/#24). No React, no Supabase dependency here.
 */

/** Lifecycle of the workout scheduled for today. */
export type TodayWorkoutState = "scheduled" | "completed" | "missed";

/** Compliance status for a single day in the weekly strip. */
export type ComplianceDayStatus = "completed" | "planned" | "missed";

export interface AthleteIdentity {
  displayName: string;
}

export interface TodayWorkout {
  id: string;
  title: string;
  exerciseCount: number;
  estimatedDurationMinutes: number;
  /** Optional: the athlete may train without an assigned coach. */
  coachName: string | null;
  state: TodayWorkoutState;
}

export interface ComplianceDay {
  /** ISO date (YYYY-MM-DD) for this day of the week. */
  date: string;
  isToday: boolean;
  status: ComplianceDayStatus;
}

export interface LastSession {
  id: string;
  title: string;
  /** ISO datetime the session was completed. */
  completedAt: string;
}

export interface PersonalRecord {
  id: string;
  label: string;
  value: string;
  /** ISO date the record was achieved. */
  achievedAt: string;
}

export interface TodayReadyData {
  readonly status: "ready";
  /** The athlete's local date (YYYY-MM-DD) — not the server's. */
  localDate: string;
  athlete: AthleteIdentity;
  /** null when nothing is scheduled today (still a "ready" screen, not "empty"). */
  todayWorkout: TodayWorkout | null;
  /** Always exactly 7 entries, one per day of the current week. */
  weeklyCompliance: ComplianceDay[];
  lastSession: LastSession | null;
  /** 0 to 3 recent personal records to surface. */
  personalRecords: PersonalRecord[];
}

/**
 * Screen-level state machine. "empty" means there is nothing to show at all
 * (e.g. a brand-new athlete profile) — distinct from a "ready" screen whose
 * `todayWorkout` happens to be null for today specifically.
 */
export type TodayViewState =
  | { readonly status: "loading" }
  | TodayReadyData
  | { readonly status: "empty" }
  | { readonly status: "error"; readonly message: string };
