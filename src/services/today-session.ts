import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type {
  ExerciseCategory,
  FinishedSessionLog,
  LastPerformance,
  LastSessionSummary,
  LoggedSet,
  OpenSessionLog,
  PlannedSession,
  PrescribedExercise,
  SkippedSessionLog,
  TodayScreenData,
  TodayState,
  WeekDay,
  WeekDayState,
  WeekSummary,
} from "@/types/today-screen";
import { localDateISO } from "@/utils/local-date";

// ============================================================================
// Today's session service (cm#104)
//
// ONE round trip. get_today_screen() (migration 007) assembles the whole payload
// server-side, which is what keeps the N+1 out: the last performance of every
// exercise is resolved by a lateral join in the same statement, not by one call
// per exercise.
//
// The RPC returns jsonb, so the payload arrives as `Json`. That is honest -- the
// database cannot promise a TypeScript shape -- and it makes this module the
// boundary where the payload is validated once and the rest of the app receives
// a fully typed object. A shape drift between the SQL and these types surfaces
// here, with a path, instead of as `undefined.map is not a function` inside a
// component.
// ============================================================================

export type TodaySessionFailure =
  /** No session, or the JWT expired. The caller should route to login. */
  | { kind: "unauthenticated" }
  /** Request failed. Retryable. */
  | { kind: "network"; message: string }
  /** The payload did not match the contract. A bug, not a user problem. */
  | { kind: "malformed"; message: string };

export type TodaySessionResult =
  | { ok: true; data: TodayScreenData }
  | { ok: false; failure: TodaySessionFailure };

type Client = SupabaseClient<Database>;

/** PostgREST returns this when the JWT is expired or otherwise unusable. */
const PGRST_JWT_ERROR = "PGRST301";

/**
 * Resolves the app's client on first use.
 *
 * Deliberately a dynamic import rather than a top-level one: `@/config/supabase`
 * imports `react-native` and constructs the client eagerly, throwing if the
 * Supabase environment variables are absent. A static import would therefore
 * drag React Native and a live configuration requirement into every unit test of
 * this module, even though every test injects its own client. Keeping it lazy
 * also stops a service from binding to a singleton at module-load time.
 */
async function resolveClient(injected?: Client): Promise<Client> {
  if (injected) return injected;
  const mod = await import("@/config/supabase");
  return mod.supabase;
}

export async function fetchTodayScreen(options?: {
  /** Athlete's local date, `yyyy-mm-dd`. Defaults to the device's today. */
  onDate?: string;
  /** Injectable for tests. */
  client?: Client;
}): Promise<TodaySessionResult> {
  const client = await resolveClient(options?.client);
  const onDate = options?.onDate ?? localDateISO();

  const { data, error } = await client.rpc("get_today_screen", { p_on_date: onDate });

  if (error) {
    if (error.code === PGRST_JWT_ERROR || /jwt|token/i.test(error.message)) {
      return { ok: false, failure: { kind: "unauthenticated" } };
    }
    return { ok: false, failure: { kind: "network", message: error.message } };
  }

  // The function returns NULL when auth.uid() is null. Distinguishing that from
  // "nothing planned" is the whole reason it returns NULL rather than an empty
  // payload.
  if (data === null) {
    return { ok: false, failure: { kind: "unauthenticated" } };
  }

  try {
    return { ok: true, data: parseTodayScreen(data) };
  } catch (cause) {
    return {
      ok: false,
      failure: {
        kind: "malformed",
        message: cause instanceof Error ? cause.message : String(cause),
      },
    };
  }
}

// ── Validation ───────────────────────────────────────────────────────────────
//
// Hand-written rather than pulled from a schema library: adding a validation
// dependency would touch the lockfile, which is the contended file with the
// design track, and this is the only payload that needs it.

class ContractError extends Error {
  constructor(path: string, expected: string, got: unknown) {
    super(`get_today_screen payload: ${path} should be ${expected}, got ${describe(got)}`);
    this.name = "ContractError";
  }
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function obj(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContractError(path, "an object", value);
  }
  return value as Record<string, unknown>;
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ContractError(path, "an array", value);
  return value;
}

function str(value: unknown, path: string): string {
  if (typeof value !== "string") throw new ContractError(path, "a string", value);
  return value;
}

function strOrNull(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  return str(value, path);
}

function num(value: unknown, path: string): number {
  // jsonb numerics arrive as numbers, but a NUMERIC wide enough to lose
  // precision would arrive as a string. Accept both rather than reject a
  // perfectly good weight.
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  throw new ContractError(path, "a number", value);
}

function numOrNull(value: unknown, path: string): number | null {
  if (value === null || value === undefined) return null;
  return num(value, path);
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new ContractError(path, "a boolean", value);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  const s = str(value, path);
  const match = allowed.find((a) => a === s);
  if (match === undefined) {
    throw new ContractError(path, `one of ${allowed.join(" | ")}`, value);
  }
  return match;
}

const EXERCISE_CATEGORIES = [
  "strength",
  "cardio",
  "flexibility",
  "mobility",
  "plyometrics",
  "other",
] as const satisfies readonly ExerciseCategory[];

const SESSION_LOG_STATUSES = ["in_progress", "completed", "skipped"] as const;

const WEEK_DAY_STATES = [
  "rest",
  "completed",
  "skipped",
  "started",
  "upcoming",
] as const satisfies readonly WeekDayState[];

export function parseTodayScreen(raw: unknown): TodayScreenData {
  const root = obj(raw, "$");
  return {
    athleteFirstName: str(root.athleteFirstName, "$.athleteFirstName"),
    date: str(root.date, "$.date"),
    today: parseTodayState(root.today, "$.today"),
    week: parseWeek(root.week, "$.week"),
    lastSession: parseLastSession(root.lastSession, "$.lastSession"),
  };
}

function parseTodayState(raw: unknown, path: string): TodayState {
  const o = obj(raw, path);
  const state = str(o.state, `${path}.state`);

  switch (state) {
    case "no-active-program":
      return { state: "no-active-program" };

    case "rest-day": {
      const next = o.nextSession;
      return {
        state: "rest-day",
        programName: str(o.programName, `${path}.programName`),
        nextSession:
          next === null || next === undefined
            ? null
            : (() => {
                const n = obj(next, `${path}.nextSession`);
                return {
                  sessionId: str(n.sessionId, `${path}.nextSession.sessionId`),
                  name: str(n.name, `${path}.nextSession.name`),
                  dayOfWeek: num(n.dayOfWeek, `${path}.nextSession.dayOfWeek`),
                };
              })(),
      };
    }

    case "scheduled":
      return { state: "scheduled", session: parseSession(o.session, `${path}.session`) };

    case "in-progress":
      return {
        state: "in-progress",
        session: parseSession(o.session, `${path}.session`),
        log: parseOpenLog(o.log, `${path}.log`),
      };

    case "completed":
      return {
        state: "completed",
        session: parseSession(o.session, `${path}.session`),
        log: parseFinishedLog(o.log, `${path}.log`),
      };

    case "skipped":
      return {
        state: "skipped",
        session: parseSession(o.session, `${path}.session`),
        log: parseSkippedLog(o.log, `${path}.log`),
      };

    default:
      // A state the SQL emits but this contract does not know. Failing here is
      // the point: silently falling back to "no-active-program" would hide a
      // migration that outran the client.
      throw new ContractError(`${path}.state`, "a known state", state);
  }
}

function parseSession(raw: unknown, path: string): PlannedSession {
  const o = obj(raw, path);
  return {
    sessionId: str(o.sessionId, `${path}.sessionId`),
    name: str(o.name, `${path}.name`),
    description: strOrNull(o.description, `${path}.description`),
    estimatedDurationMinutes: numOrNull(
      o.estimatedDurationMinutes,
      `${path}.estimatedDurationMinutes`,
    ),
    weekNumber: numOrNull(o.weekNumber, `${path}.weekNumber`),
    dayOfWeek: numOrNull(o.dayOfWeek, `${path}.dayOfWeek`),
    exercises: arr(o.exercises, `${path}.exercises`).map((e, i) =>
      parseExercise(e, `${path}.exercises[${i}]`),
    ),
    programName: str(o.programName, `${path}.programName`),
    coachFirstName: strOrNull(o.coachFirstName, `${path}.coachFirstName`),
  };
}

function parseExercise(raw: unknown, path: string): PrescribedExercise {
  const o = obj(raw, path);
  return {
    sessionExerciseId: str(o.sessionExerciseId, `${path}.sessionExerciseId`),
    exerciseId: str(o.exerciseId, `${path}.exerciseId`),
    name: str(o.name, `${path}.name`),
    category: oneOf(o.category, EXERCISE_CATEGORIES, `${path}.category`),
    equipment: strOrNull(o.equipment, `${path}.equipment`),
    muscleGroups: arr(o.muscleGroups, `${path}.muscleGroups`).map((m, i) =>
      str(m, `${path}.muscleGroups[${i}]`),
    ),
    videoUrl: strOrNull(o.videoUrl, `${path}.videoUrl`),
    instructions: strOrNull(o.instructions, `${path}.instructions`),
    orderIndex: num(o.orderIndex, `${path}.orderIndex`),
    sets: numOrNull(o.sets, `${path}.sets`),
    // Stays a string. See the note on PrescribedExercise.reps.
    reps: strOrNull(o.reps, `${path}.reps`),
    weightSuggestion: strOrNull(o.weightSuggestion, `${path}.weightSuggestion`),
    restSeconds: numOrNull(o.restSeconds, `${path}.restSeconds`),
    tempo: strOrNull(o.tempo, `${path}.tempo`),
    notes: strOrNull(o.notes, `${path}.notes`),
    supersetGroup: numOrNull(o.supersetGroup, `${path}.supersetGroup`),
    lastPerformance: parseLastPerformance(o.lastPerformance, `${path}.lastPerformance`),
  };
}

function parseLastPerformance(raw: unknown, path: string): LastPerformance | null {
  if (raw === null || raw === undefined) return null;
  const o = obj(raw, path);
  return {
    performedAt: str(o.performedAt, `${path}.performedAt`),
    sets: arr(o.sets, `${path}.sets`).map((s, i) => parseSet(s, `${path}.sets[${i}]`)),
  };
}

function parseSet(raw: unknown, path: string): LoggedSet {
  const o = obj(raw, path);
  return {
    setNumber: num(o.setNumber, `${path}.setNumber`),
    repsCompleted: numOrNull(o.repsCompleted, `${path}.repsCompleted`),
    weightKg: numOrNull(o.weightKg, `${path}.weightKg`),
    rpe: numOrNull(o.rpe, `${path}.rpe`),
    durationSeconds: numOrNull(o.durationSeconds, `${path}.durationSeconds`),
    distanceMeters: numOrNull(o.distanceMeters, `${path}.distanceMeters`),
    isPr: bool(o.isPr, `${path}.isPr`),
  };
}

function parseOpenLog(raw: unknown, path: string): OpenSessionLog {
  const o = obj(raw, path);
  return {
    sessionLogId: str(o.sessionLogId, `${path}.sessionLogId`),
    startedAt: strOrNull(o.startedAt, `${path}.startedAt`),
    status: oneOf(o.status, SESSION_LOG_STATUSES, `${path}.status`),
    loggedSetCount: num(o.loggedSetCount, `${path}.loggedSetCount`),
    pausedAt: strOrNull(o.pausedAt, `${path}.pausedAt`),
    totalPausedSeconds: num(o.totalPausedSeconds, `${path}.totalPausedSeconds`),
  };
}

function parseFinishedLog(raw: unknown, path: string): FinishedSessionLog {
  const o = obj(raw, path);
  return {
    sessionLogId: str(o.sessionLogId, `${path}.sessionLogId`),
    startedAt: strOrNull(o.startedAt, `${path}.startedAt`),
    status: oneOf(o.status, SESSION_LOG_STATUSES, `${path}.status`),
    loggedSetCount: num(o.loggedSetCount, `${path}.loggedSetCount`),
    completedAt: str(o.completedAt, `${path}.completedAt`),
    durationMinutes: numOrNull(o.durationMinutes, `${path}.durationMinutes`),
    overallRpe: numOrNull(o.overallRpe, `${path}.overallRpe`),
    notes: strOrNull(o.notes, `${path}.notes`),
  };
}

function parseSkippedLog(raw: unknown, path: string): SkippedSessionLog {
  const o = obj(raw, path);
  return {
    sessionLogId: str(o.sessionLogId, `${path}.sessionLogId`),
    startedAt: strOrNull(o.startedAt, `${path}.startedAt`),
    status: oneOf(o.status, SESSION_LOG_STATUSES, `${path}.status`),
    loggedSetCount: num(o.loggedSetCount, `${path}.loggedSetCount`),
  };
}

function parseWeek(raw: unknown, path: string): WeekSummary {
  const o = obj(raw, path);
  const days = arr(o.days, `${path}.days`).map((d, i) => parseWeekDay(d, `${path}.days[${i}]`));
  if (days.length !== 7) {
    // The week strip is rendered as seven fixed slots. A short array would
    // silently drop days rather than fail, so it is rejected.
    throw new ContractError(`${path}.days`, "exactly 7 entries", days.length);
  }
  return {
    weekNumber: numOrNull(o.weekNumber, `${path}.weekNumber`),
    days,
    completedCount: num(o.completedCount, `${path}.completedCount`),
    scheduledCount: num(o.scheduledCount, `${path}.scheduledCount`),
  };
}

function parseWeekDay(raw: unknown, path: string): WeekDay {
  const o = obj(raw, path);
  return {
    dayOfWeek: num(o.dayOfWeek, `${path}.dayOfWeek`),
    isToday: bool(o.isToday, `${path}.isToday`),
    state: oneOf(o.state, WEEK_DAY_STATES, `${path}.state`),
  };
}

function parseLastSession(raw: unknown, path: string): LastSessionSummary | null {
  if (raw === null || raw === undefined) return null;
  const o = obj(raw, path);
  return {
    sessionLogId: str(o.sessionLogId, `${path}.sessionLogId`),
    name: str(o.name, `${path}.name`),
    completedAt: str(o.completedAt, `${path}.completedAt`),
    exerciseCount: num(o.exerciseCount, `${path}.exerciseCount`),
    durationMinutes: numOrNull(o.durationMinutes, `${path}.durationMinutes`),
    prCount: num(o.prCount, `${path}.prCount`),
  };
}
