import type { Enums } from "./database";

// ============================================================================
// Data contract of the home screen (cm#101 / cm#104)
//
// Published on cm#101 before the UI was built, so the design track could code
// against fixtures while this service was written. Produced by the
// get_today_screen() RPC (migration 007) and validated at the service boundary.
//
// Every field maps to a column that exists in supabase/migrations/. Nothing is
// invented. Fields the schema cannot serve are absent rather than optional --
// notably "prochains PRs potentiels" from the wireframe, which needs cm#31.
//
// Units are named in the identifiers, not left to a comment: the frozen web
// schema stored distance_km and duration_minutes where the canonical schema
// stores distance_meters and duration_seconds. Both are numbers, no type would
// have caught a mix-up, and a naive port would have been wrong by 1000 and 60.
// ============================================================================

/** `exercise_category` enum. */
export type ExerciseCategory = Enums<"exercise_category">;

/** `session_log_status` enum. */
export type SessionLogStatus = Enums<"session_log_status">;

// ── Previous performance ─────────────────────────────────────────────────────

/** One logged set, from `exercise_logs`. */
export type LoggedSet = {
  setNumber: number;
  repsCompleted: number | null;
  weightKg: number | null;
  /** 1..10 */
  rpe: number | null;
  durationSeconds: number | null;
  /** metres, not kilometres */
  distanceMeters: number | null;
  isPr: boolean;
};

/** The athlete's most recent completed work on one exercise. */
export type LastPerformance = {
  /** `session_logs.completed_at` of the session these sets belong to */
  performedAt: string;
  /** ordered by `exercise_logs.set_number` */
  sets: LoggedSet[];
};

// ── Prescription ─────────────────────────────────────────────────────────────

export type PrescribedExercise = {
  /** `session_exercises.id` — the row a logged set is attributed to */
  sessionExerciseId: string;
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  equipment: string | null;
  muscleGroups: string[];
  videoUrl: string | null;
  instructions: string | null;
  orderIndex: number;
  sets: number | null;
  /**
   * `session_exercises.reps` is TEXT: "8-12" and "AMRAP" are both valid.
   * Never parse this to a number -- real templates will break it.
   */
  reps: string | null;
  /** TEXT, e.g. "70% 1RM" */
  weightSuggestion: string | null;
  /** drives the rest timer (cm#27) */
  restSeconds: number | null;
  /** TEXT, e.g. "3-1-1-0" */
  tempo: string | null;
  notes: string | null;
  /** same value = same superset */
  supersetGroup: number | null;
  /** null when the athlete has never logged this exercise */
  lastPerformance: LastPerformance | null;
};

export type PlannedSession = {
  sessionId: string;
  name: string;
  description: string | null;
  estimatedDurationMinutes: number | null;
  weekNumber: number | null;
  /** ISODOW: 1 = Monday */
  dayOfWeek: number | null;
  /** ordered by `session_exercises.order_index` */
  exercises: PrescribedExercise[];
  programName: string;
  /**
   * `profiles.first_name` of `programs.coach_id`.
   * null for a self-created program, which is the normal case in 2026.
   */
  coachFirstName: string | null;
};

// ── The log of the session in flight, or already finished ────────────────────

export type OpenSessionLog = {
  sessionLogId: string;
  startedAt: string | null;
  status: SessionLogStatus;
  /** `exercise_logs` rows already written for this log */
  loggedSetCount: number;
  /** non-null while the session is paused (migration 005) */
  pausedAt: string | null;
  totalPausedSeconds: number;
};

export type FinishedSessionLog = {
  sessionLogId: string;
  startedAt: string | null;
  status: SessionLogStatus;
  loggedSetCount: number;
  completedAt: string;
  durationMinutes: number | null;
  /** 1..10 */
  overallRpe: number | null;
  notes: string | null;
};

export type SkippedSessionLog = {
  sessionLogId: string;
  startedAt: string | null;
  status: SessionLogStatus;
  loggedSetCount: number;
};

// ── The state machine ────────────────────────────────────────────────────────

/**
 * Discriminated on `state`, not a bag of optional fields: a screen must not be
 * able to render "session in progress" while `session` happens to be null.
 *
 * "no session today" is deliberately two states rather than one. The copy and
 * the call to action differ completely -- "Parcourir les templates" versus
 * "Jour de repos" -- and merging them would force a nullable field the contract
 * exists to avoid.
 */
export type TodayState =
  /** No `program_assignments` row in force on this date. */
  | { state: "no-active-program" }
  /** An assignment is in force, but no session matches today. */
  | {
      state: "rest-day";
      programName: string;
      /** the next session later in the week, null if none remains */
      nextSession: { sessionId: string; name: string; dayOfWeek: number } | null;
    }
  /** A session is planned and has no log yet. */
  | { state: "scheduled"; session: PlannedSession }
  /** A log exists with status `in_progress`. */
  | { state: "in-progress"; session: PlannedSession; log: OpenSessionLog }
  /** A log exists with status `completed` on this date. */
  | { state: "completed"; session: PlannedSession; log: FinishedSessionLog }
  /** A log exists with status `skipped`. */
  | { state: "skipped"; session: PlannedSession; log: SkippedSessionLog };

// ── Surrounding blocks ───────────────────────────────────────────────────────

export type WeekDayState = "rest" | "completed" | "skipped" | "started" | "upcoming";

export type WeekDay = {
  /** ISODOW: 1 = Monday */
  dayOfWeek: number;
  isToday: boolean;
  state: WeekDayState;
};

export type WeekSummary = {
  /** derived from `program_assignments.start_date`; null with no assignment */
  weekNumber: number | null;
  /** always 7 entries, Monday first */
  days: WeekDay[];
  completedCount: number;
  scheduledCount: number;
};

export type LastSessionSummary = {
  sessionLogId: string;
  name: string;
  completedAt: string;
  /** distinct `exercise_logs.exercise_id` in that log */
  exerciseCount: number;
  durationMinutes: number | null;
  /**
   * `exercise_logs` rows with `is_pr`. Populated by the trigger added in
   * migration 006, so this is 0 for every session logged before it landed.
   */
  prCount: number;
};

// ── Root ─────────────────────────────────────────────────────────────────────

export type TodayScreenData = {
  athleteFirstName: string;
  /** the local date the payload was computed for, ISO yyyy-mm-dd */
  date: string;
  today: TodayState;
  week: WeekSummary;
  /** null until the athlete has completed at least one session */
  lastSession: LastSessionSummary | null;
};
