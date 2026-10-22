import type { QueryData, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type {
  PlanSession,
  PlanWeek,
  ProgramPlan,
  ProgramPlanResult,
} from "@/types/program-plan";
import { localDateISO } from "@/utils/local-date";
import {
  fromDayNumber,
  occurrenceState,
  sessionDate,
  toDayNumber,
  weekCount,
} from "@/utils/program-schedule";

// ============================================================================
// The athlete's full training plan (cm#23)
//
// ONE embedded select rather than an RPC. The home screen needed a server-side
// function because its five blocks had sequential dependencies; this data is a
// single tree -- assignment -> program -> sessions -> logs -- so PostgREST
// embedding fetches it in one round trip AND the generated types describe the
// result end to end, with no hand-written validator.
//
// That only became possible once the type generator started emitting
// Relationships (see the R6 commit): without it postgrest-js cannot type an
// embed at all.
//
// Soft deletes are not filtered here. Every RLS policy involved already carries
// `NOT is_deleted`, so deleted rows are invisible to this query -- adding client
// filters would duplicate the rule and let the two drift.
// ============================================================================

type Client = SupabaseClient<Database>;

const PGRST_JWT_ERROR = "PGRST301";

/**
 * Lazy, for the reason documented in today-session.ts: a static import of the
 * configured client drags React Native and a live environment requirement into
 * every unit test of this module.
 */
async function resolveClient(injected?: Client): Promise<Client> {
  if (injected) return injected;
  const mod = await import("@/config/supabase");
  return mod.supabase;
}

const PLAN_QUERY = `
  id, start_date, end_date, status,
  programs!inner (
    id, name, description, goal, difficulty, duration_weeks,
    sessions (
      id, name, description, day_of_week, week_number, order_index,
      estimated_duration_minutes,
      session_exercises ( id ),
      session_logs ( id, status, started_at, completed_at )
    )
  )
` as const;

export async function fetchProgramPlan(options?: {
  /** Athlete's local date, `yyyy-mm-dd`. Drives which week is "current". */
  onDate?: string;
  client?: Client;
}): Promise<ProgramPlanResult> {
  const client = await resolveClient(options?.client);
  const today = options?.onDate ?? localDateISO();

  const { data, error } = await planQuery(client)
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === PGRST_JWT_ERROR || /jwt|token/i.test(error.message)) {
      return { ok: false, failure: { kind: "unauthenticated" } };
    }
    return { ok: false, failure: { kind: "network", message: error.message } };
  }

  if (!data) {
    return { ok: true, state: { kind: "no-active-program" } };
  }

  // An assignment with no start_date cannot be laid out on a calendar at all --
  // every week and every session date derives from it. Treated as "no plan"
  // rather than crashing or inventing a start.
  const startDate = data.start_date;
  if (startDate === null) {
    return { ok: true, state: { kind: "no-active-program" } };
  }

  return { ok: true, state: { kind: "plan", plan: buildPlan(data, startDate, today) } };
}

/**
 * The shape of one embedded row, derived from the query itself via `QueryData`.
 *
 * This is the documented way to name an embedded result: the type follows the
 * select string, so adding or removing a column in PLAN_QUERY updates it and
 * anything reading a field that is no longer selected fails to compile. Writing
 * the shape out by hand would let the two drift silently.
 */
type PlanQueryRows = QueryData<ReturnType<typeof planQuery>>;
type PlanRow = PlanQueryRows[number];

function planQuery(client: Client) {
  return client.from("program_assignments").select(PLAN_QUERY);
}

function buildPlan(row: PlanRow, startDate: string, today: string): ProgramPlan {
  const program = row.programs;
  const sessions = program.sessions;

  const totalWeeks = weekCount(
    program.duration_weeks,
    sessions.map((s) => s.week_number),
  );

  // Logs are keyed by session id, each carrying the date it happened on. The
  // date is what occurrenceState() matches against -- see the note there on why
  // matching by id alone is wrong for a repeating session.
  const logsBySession = new Map<
    string,
    { date: string; status: "in_progress" | "completed" | "skipped" }[]
  >();
  for (const session of sessions) {
    const entries = session.session_logs
      .map((log) => {
        const stamp = log.completed_at ?? log.started_at;
        return stamp === null ? null : { date: stamp.slice(0, 10), status: log.status };
      })
      .filter((entry): entry is { date: string; status: "in_progress" | "completed" | "skipped" } =>
        entry !== null,
      );
    logsBySession.set(session.id, entries);
  }

  const weeks: PlanWeek[] = [];
  let totalSessions = 0;
  let completedSessions = 0;

  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
    const weekStartDay = toDayNumber(startDate) + (weekNumber - 1) * 7;

    // A session pinned to this week, or one that repeats every week.
    const forThisWeek = sessions.filter(
      (s) => s.week_number === weekNumber || s.week_number === null,
    );

    const planSessions: PlanSession[] = forThisWeek
      .map((s): PlanSession => {
        const scheduledDate = sessionDate(startDate, weekNumber, s.day_of_week);
        return {
          sessionId: s.id,
          name: s.name,
          description: s.description,
          dayOfWeek: s.day_of_week,
          estimatedDurationMinutes: s.estimated_duration_minutes,
          exerciseCount: s.session_exercises.length,
          scheduledDate,
          state: occurrenceState({
            scheduledDate,
            todayDate: today,
            logs: logsBySession.get(s.id) ?? [],
          }),
        };
      })
      .sort(
        (a, b) =>
          (a.dayOfWeek ?? 8) - (b.dayOfWeek ?? 8) ||
          a.name.localeCompare(b.name, "fr"),
      );

    const completedCount = planSessions.filter((s) => s.state === "completed").length;
    totalSessions += planSessions.length;
    completedSessions += completedCount;

    const weekStart = fromDayNumber(weekStartDay);
    const weekEnd = fromDayNumber(weekStartDay + 6);
    const todayDay = toDayNumber(today);

    weeks.push({
      weekNumber,
      startDate: weekStart,
      endDate: weekEnd,
      isCurrent: todayDay >= weekStartDay && todayDay <= weekStartDay + 6,
      sessions: planSessions,
      completedCount,
    });
  }

  return {
    programId: program.id,
    name: program.name,
    description: program.description,
    goal: program.goal,
    difficulty: program.difficulty,
    durationWeeks: program.duration_weeks,
    startDate,
    weeks,
    totalSessions,
    completedSessions,
  };
}
