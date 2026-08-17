import type { Enums } from "./database";
import type { SessionOccurrenceState } from "@/utils/program-schedule";

// ============================================================================
// Data contract of the full plan view (cm#23)
//
// Produced by src/services/program-plan.ts from a single embedded select. Unlike
// the home screen, this one needs no server-side assembly: the data is one tree
// (assignment -> program -> sessions -> logs), so PostgREST embedding fetches it
// in one round trip and the generated types describe it end to end.
// ============================================================================

export type Difficulty = Enums<"difficulty_level">;

export type PlanSession = {
  sessionId: string;
  name: string;
  description: string | null;
  /** ISODOW: 1 = Monday. Null when the program does not pin a day. */
  dayOfWeek: number | null;
  estimatedDurationMinutes: number | null;
  /** number of `session_exercises` rows */
  exerciseCount: number;
  /** the calendar date this occurrence falls on, null when dayOfWeek is null */
  scheduledDate: string | null;
  state: SessionOccurrenceState;
};

export type PlanWeek = {
  /** 1-based */
  weekNumber: number;
  /** first day of the week, anchored on the assignment's start date */
  startDate: string;
  /** last day, inclusive */
  endDate: string;
  isCurrent: boolean;
  /** ordered by dayOfWeek then order_index */
  sessions: PlanSession[];
  completedCount: number;
};

export type ProgramPlan = {
  programId: string;
  name: string;
  description: string | null;
  goal: string | null;
  difficulty: Difficulty | null;
  /** `programs.duration_weeks`, which may exceed the weeks actually written out */
  durationWeeks: number | null;
  /** `program_assignments.start_date` */
  startDate: string;
  /** always one entry per week of the program, empty weeks included */
  weeks: PlanWeek[];
  totalSessions: number;
  completedSessions: number;
};

/**
 * "No program" is a state of the plan, not a failure: an athlete who has not
 * started a template yet is in a perfectly normal situation and the screen shows
 * them a call to action, not an error.
 */
export type ProgramPlanState =
  | { kind: "no-active-program" }
  | { kind: "plan"; plan: ProgramPlan };

export type ProgramPlanFailure =
  | { kind: "unauthenticated" }
  | { kind: "network"; message: string };

export type ProgramPlanResult =
  | { ok: true; state: ProgramPlanState }
  | { ok: false; failure: ProgramPlanFailure };
