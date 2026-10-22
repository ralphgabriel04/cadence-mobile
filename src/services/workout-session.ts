import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { LoggedSet } from "@/features/training/workout-state";
import type { QueuedSet, SendResult } from "@/services/set-queue";

// ============================================================================
// Writes for a session in progress (cm#25)
//
// Three operations: open a session, push one set, close a session. Everything
// else the training screen needs is read by the today-session service.
// ============================================================================

type Client = SupabaseClient<Database>;

const PGRST_JWT_ERROR = "PGRST301";
/** PostgreSQL unique_violation. */
const PG_UNIQUE_VIOLATION = "23505";

async function resolveClient(injected?: Client): Promise<Client> {
  if (injected) return injected;
  const mod = await import("@/config/supabase");
  return mod.supabase;
}

export type StartSessionResult =
  | { ok: true; sessionLogId: string; resumed: boolean }
  | { ok: false; kind: "unauthenticated" | "network"; message: string };

/**
 * Opens a session, or returns the one already open.
 *
 * Migration 005 enforces at most one in-progress log per athlete, so "start"
 * genuinely means "start or resume". Checking first rather than inserting and
 * catching the violation keeps the happy path free of an error round trip and
 * lets the caller tell the two apart -- resuming should not reset the clock.
 */
export async function startSession(args: {
  sessionId: string;
  athleteId: string;
  programAssignmentId?: string | null;
  client?: Client;
}): Promise<StartSessionResult> {
  const client = await resolveClient(args.client);

  // Filtered on the athlete explicitly: RLS also lets a coach read the logs of
  // the athletes they follow, and resuming one of those would write sets into
  // somebody else's session.
  const existing = await client
    .from("session_logs")
    .select("id, session_id")
    .eq("athlete_id", args.athleteId)
    .eq("is_deleted", false)
    .eq("status", "in_progress")
    .limit(1)
    .maybeSingle();

  if (existing.error) return failure(existing.error);

  if (existing.data) {
    // An open log for a DIFFERENT session is not an error the athlete caused --
    // they left one running yesterday. Returning it lets the caller decide
    // whether to resume it or close it, instead of failing the unique index.
    return { ok: true, sessionLogId: existing.data.id, resumed: true };
  }

  const created = await client
    .from("session_logs")
    .insert({
      session_id: args.sessionId,
      athlete_id: args.athleteId,
      program_assignment_id: args.programAssignmentId ?? null,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (created.error) return failure(created.error);
  return { ok: true, sessionLogId: created.data.id, resumed: false };
}

/**
 * Sends one set. This is the {@link SetSender} the queue drives.
 *
 * WHY NOT `upsert`
 * The idempotency index from migration 005 is PARTIAL --
 * `UNIQUE (session_log_id, exercise_id, set_number) WHERE NOT is_deleted`.
 * PostgreSQL only matches an ON CONFLICT target to a partial index when the
 * statement repeats the index predicate, and PostgREST has no way to express
 * that, so `upsert(..., { onConflict })` fails outright with "no unique or
 * exclusion constraint matching the ON CONFLICT specification".
 *
 * Insert-then-update-on-conflict handles both cases the queue produces:
 *   * a RETRY of a request that actually landed -- the update rewrites the same
 *     values, which is a no-op;
 *   * a CORRECTION of a set the athlete edited before it was sent -- the update
 *     writes the new values, which is exactly what should happen.
 * Treating the conflict as "already done" would silently drop corrections.
 */
export async function sendSet(entry: QueuedSet, client?: Client): Promise<SendResult> {
  const db = await resolveClient(client);

  const row = {
    session_log_id: entry.sessionLogId,
    exercise_id: entry.exerciseId,
    session_exercise_id: entry.sessionExerciseId,
    set_number: entry.setNumber,
    reps_completed: entry.repsCompleted,
    weight_kg: entry.weightKg,
    rpe: entry.rpe,
    duration_seconds: entry.durationSeconds,
    distance_meters: entry.distanceMeters,
    notes: entry.notes,
  };

  const inserted = await db.from("exercise_logs").insert(row);
  if (!inserted.error) return { ok: true };

  if (inserted.error.code === PG_UNIQUE_VIOLATION) {
    const updated = await db
      .from("exercise_logs")
      .update(row)
      .eq("session_log_id", entry.sessionLogId)
      .eq("exercise_id", entry.exerciseId)
      .eq("set_number", entry.setNumber)
      .eq("is_deleted", false);

    if (!updated.error) return { ok: true };
    return sendFailure(updated.error);
  }

  return sendFailure(inserted.error);
}

export type CompleteSessionResult =
  | { ok: true }
  | { ok: false; kind: "unauthenticated" | "network"; message: string };

/**
 * Closes a session.
 *
 * `status` and `completed_at` are written together because migration 005 adds a
 * CHECK requiring them to agree -- the frozen web app wrote only `completed_at`
 * and left every finished session sitting at `in_progress`.
 *
 * The duration is computed by the caller and passed in: it is
 * (completed - started) minus the accumulated pause, and the pause total lives
 * in the state the caller holds.
 */
export async function completeSession(args: {
  sessionLogId: string;
  completedAt: string;
  durationMinutes: number | null;
  overallRpe?: number | null;
  notes?: string | null;
  client?: Client;
}): Promise<CompleteSessionResult> {
  const client = await resolveClient(args.client);

  const { error } = await client
    .from("session_logs")
    .update({
      status: "completed",
      completed_at: args.completedAt,
      duration_minutes: args.durationMinutes,
      overall_rpe: args.overallRpe ?? null,
      notes: args.notes ?? null,
      paused_at: null,
    })
    .eq("id", args.sessionLogId);

  if (error) return failure(error);
  return { ok: true };
}

export type LoadSessionResult =
  | { ok: true; sessionLogId: string; startedAt: string | null; logged: LoggedSet[] }
  | { ok: true; sessionLogId: null; startedAt: null; logged: [] }
  | { ok: false; kind: "unauthenticated" | "network"; message: string };

/**
 * Reads back an in-progress session so the screen can resume it.
 *
 * This is what makes an interrupted session recoverable: the sets that reached
 * the server are the ones that count, and the queue holds the rest.
 */
export async function loadInProgressSession(args: {
  athleteId: string;
  client?: Client;
}): Promise<LoadSessionResult> {
  const client = await resolveClient(args.client);

  const { data, error } = await client
    .from("session_logs")
    .select(
      "id, started_at, exercise_logs ( exercise_id, session_exercise_id, set_number, reps_completed, weight_kg, rpe, created_at )",
    )
    .eq("athlete_id", args.athleteId)
    .eq("is_deleted", false)
    .eq("status", "in_progress")
    .limit(1)
    .maybeSingle();

  if (error) return failure(error);
  if (!data) return { ok: true, sessionLogId: null, startedAt: null, logged: [] };

  const logged: LoggedSet[] = data.exercise_logs.map((log) => ({
    exerciseId: log.exercise_id,
    sessionExerciseId: log.session_exercise_id,
    setNumber: log.set_number,
    // A set with no reps recorded counts as zero rather than being dropped:
    // losing it here would let the queue re-send it under a number already
    // taken, and the athlete would see a gap in their session.
    repsCompleted: log.reps_completed ?? 0,
    weightKg: log.weight_kg,
    rpe: log.rpe,
    loggedAt: log.created_at,
  }));

  return { ok: true, sessionLogId: data.id, startedAt: data.started_at, logged };
}

// ── Error mapping ────────────────────────────────────────────────────────────

type PostgrestErrorLike = { message: string; code?: string };

function isAuthError(error: PostgrestErrorLike): boolean {
  return error.code === PGRST_JWT_ERROR || /jwt|token/i.test(error.message);
}

function failure(error: PostgrestErrorLike): {
  ok: false;
  kind: "unauthenticated" | "network";
  message: string;
} {
  return {
    ok: false,
    kind: isAuthError(error) ? "unauthenticated" : "network",
    message: error.message,
  };
}

/**
 * Whether the queue should keep trying.
 *
 * Retryable: anything transient -- no network, a timeout, an expired token that
 * the auth provider will refresh.
 *
 * NOT retryable: the server understood and refused. A check-constraint
 * violation, a foreign key that no longer resolves, a policy that denies the
 * write. Those will be refused identically forever, and leaving them in the
 * queue blocks every set behind them.
 */
function sendFailure(error: PostgrestErrorLike): SendResult {
  const permanent =
    error.code === "23514" || // check_violation
    error.code === "23503" || // foreign_key_violation
    error.code === "22P02" || // invalid_text_representation
    error.code === "42501"; // insufficient_privilege (RLS refused)

  return { ok: false, message: error.message, retryable: !permanent };
}
