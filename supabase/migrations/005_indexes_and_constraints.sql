-- ============================================================================
-- 005 — Indexes, integrity constraints, and session pause
-- ============================================================================
--
-- Three groups:
--   1. indexes the read paths of cm#23, cm#29, cm#31 and cm#104 depend on
--   2. integrity constraints, including the partial unique index that makes the
--      offline retry queue of cm#25 idempotent
--   3. session pause columns (ADR-004 decision 5, ported from the frozen
--      schema's 009_session_pause.sql)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. INDEXES
-- ----------------------------------------------------------------------------

-- exercise_logs is the largest table in the system and 001 indexed it only by
-- session_log_id. Every per-exercise read -- last performance during logging
-- (cm#29), history view, PR detection (cm#31) -- filters on exercise_id and
-- would otherwise sequentially scan it.
CREATE INDEX idx_exercise_logs_exercise
  ON exercise_logs(exercise_id) WHERE NOT is_deleted;

-- "the athlete's last sets on this exercise" is the hottest query in the app:
-- it runs once per exercise on the logging screen. Ordering by set_number here
-- lets the planner satisfy both the filter and the ordering from the index.
CREATE INDEX idx_exercise_logs_exercise_set
  ON exercise_logs(exercise_id, session_log_id, set_number) WHERE NOT is_deleted;

-- Personal records (cm#31): find the heaviest logged set for one exercise.
-- Partial on is_pr keeps the index tiny -- PR rows are a fraction of the table.
CREATE INDEX idx_exercise_logs_prs
  ON exercise_logs(exercise_id, weight_kg DESC)
  WHERE is_pr AND NOT is_deleted;

-- "last completed session" on the home screen, and the weekly summary.
CREATE INDEX idx_session_logs_athlete_completed
  ON session_logs(athlete_id, completed_at DESC)
  WHERE completed_at IS NOT NULL AND NOT is_deleted;

-- "the athlete's active assignment" is the entry point of the today screen
-- (cm#104) and runs on every app open.
CREATE INDEX idx_program_assignments_active
  ON program_assignments(athlete_id, start_date)
  WHERE status = 'active' AND NOT is_deleted;

-- Full program view (cm#23) walks a program week by week, day by day.
CREATE INDEX idx_sessions_program_week_day
  ON sessions(program_id, week_number, day_of_week) WHERE NOT is_deleted;

-- ----------------------------------------------------------------------------
-- 2. INTEGRITY CONSTRAINTS
-- ----------------------------------------------------------------------------
--
-- 2a. Normalise existing rows FIRST.
--
-- Adding a constraint to a table that already violates it aborts the migration.
-- Two violations are expected on any database the frozen web app has written to:
--
--   * completeSession() in web/app/src/lib/actions/training.ts sets
--     completed_at, overall_rpe and duration_minutes but never touches `status`.
--     Completed sessions therefore sit at status = 'in_progress'.
--   * the same code path has no guard against starting a session twice, so
--     duplicate in-progress logs and duplicate set numbers can both exist.
--
-- Duplicates are soft-deleted rather than removed, keeping the most recent row,
-- so nothing is destroyed and the rows remain auditable.

UPDATE session_logs
   SET status = 'completed'
 WHERE completed_at IS NOT NULL
   AND status <> 'completed';

UPDATE session_logs
   SET completed_at = COALESCE(updated_at, created_at)
 WHERE status = 'completed'
   AND completed_at IS NULL;

-- Keep the newest in-progress log per athlete, soft-delete the rest.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY athlete_id ORDER BY started_at DESC, created_at DESC) AS rn
    FROM session_logs
   WHERE status = 'in_progress' AND NOT is_deleted
)
UPDATE session_logs sl
   SET is_deleted = TRUE, deleted_at = NOW()
  FROM ranked r
 WHERE sl.id = r.id AND r.rn > 1;

-- Keep the newest row per (session_log, exercise, set), soft-delete the rest.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY session_log_id, exercise_id, set_number
           ORDER BY created_at DESC, id DESC
         ) AS rn
    FROM exercise_logs
   WHERE NOT is_deleted
)
UPDATE exercise_logs el
   SET is_deleted = TRUE, deleted_at = NOW()
  FROM ranked r
 WHERE el.id = r.id AND r.rn > 1;

-- 2b. Now the constraints.

-- Makes the offline retry queue of cm#25 idempotent.
--
-- A gym has unreliable connectivity, so a logged set is queued locally and
-- retried until the server acknowledges it. Without a uniqueness rule, a
-- request that actually succeeded but whose response was lost gets retried and
-- inserts the set twice -- silently doubling the athlete's volume. With this
-- index the writer can use ON CONFLICT and a retry becomes a no-op.
--
-- Partial on NOT is_deleted so a soft-deleted set does not block re-logging the
-- same set number.
CREATE UNIQUE INDEX idx_exercise_logs_unique_set
  ON exercise_logs(session_log_id, exercise_id, set_number)
  WHERE NOT is_deleted;

COMMENT ON INDEX idx_exercise_logs_unique_set IS
  'Idempotency key for set logging. Writers must INSERT ... ON CONFLICT on (session_log_id, exercise_id, set_number) so a retried request after a lost response does not duplicate the set.';

-- At most one session in flight per athlete. Prevents the double-tap on
-- "Commencer la séance" from opening two concurrent logs, and makes "resume the
-- interrupted session" a single-row lookup with no tie-breaking rule.
--
-- Note on what was NOT used here: an earlier draft keyed this on
-- (athlete_id, session_id, started_at::date). That cannot be indexed --
-- casting TIMESTAMPTZ to DATE depends on the session TimeZone, so the
-- expression is STABLE, not IMMUTABLE, and PostgreSQL rejects it in an index.
-- Keying on status avoids the problem and expresses the real product rule.
CREATE UNIQUE INDEX idx_session_logs_one_in_progress
  ON session_logs(athlete_id)
  WHERE status = 'in_progress' AND NOT is_deleted;

COMMENT ON INDEX idx_session_logs_one_in_progress IS
  'One in-progress session per athlete. Also serves the resume lookup of cm#25.';

-- Value ranges. These are cheap and they catch unit mistakes at the boundary
-- rather than after they have polluted aggregates.
ALTER TABLE exercise_logs
  ADD CONSTRAINT exercise_logs_set_number_positive CHECK (set_number >= 1),
  ADD CONSTRAINT exercise_logs_reps_non_negative CHECK (reps_completed IS NULL OR reps_completed >= 0),
  ADD CONSTRAINT exercise_logs_weight_non_negative CHECK (weight_kg IS NULL OR weight_kg >= 0),
  ADD CONSTRAINT exercise_logs_duration_non_negative CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  ADD CONSTRAINT exercise_logs_distance_non_negative CHECK (distance_meters IS NULL OR distance_meters >= 0);

ALTER TABLE session_exercises
  ADD CONSTRAINT session_exercises_sets_positive CHECK (sets IS NULL OR sets >= 1),
  ADD CONSTRAINT session_exercises_rest_non_negative CHECK (rest_seconds IS NULL OR rest_seconds >= 0);

ALTER TABLE session_logs
  ADD CONSTRAINT session_logs_duration_non_negative CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  ADD CONSTRAINT session_logs_completed_after_started CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at);

-- A completed session must carry its completion timestamp, and vice versa.
-- Without this the two can disagree and every "is it done?" check has to pick
-- one arbitrarily.
ALTER TABLE session_logs
  ADD CONSTRAINT session_logs_status_matches_completed_at CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status <> 'completed' AND completed_at IS NULL)
  );

ALTER TABLE programs
  ADD CONSTRAINT programs_duration_positive CHECK (duration_weeks IS NULL OR duration_weeks >= 1);

ALTER TABLE program_assignments
  ADD CONSTRAINT program_assignments_end_after_start CHECK (
    end_date IS NULL OR start_date IS NULL OR end_date >= start_date
  );

-- ----------------------------------------------------------------------------
-- 3. SESSION PAUSE (ADR-004 decision 5)
-- ----------------------------------------------------------------------------
-- Ported from the frozen schema's 009_session_pause.sql. Settled as YES because
-- session duration is computed by the live-logging feature (cm#25): without
-- pause tracking, elapsed time counts wall-clock and overstates the session
-- whenever an athlete is interrupted. Retrofitting it after cm#25 ships means
-- revisiting that logic and every duration already recorded.

ALTER TABLE session_logs
  ADD COLUMN paused_at TIMESTAMPTZ,
  ADD COLUMN total_paused_seconds INTEGER NOT NULL DEFAULT 0;

ALTER TABLE session_logs
  ADD CONSTRAINT session_logs_paused_seconds_non_negative CHECK (total_paused_seconds >= 0),
  ADD CONSTRAINT session_logs_not_paused_when_completed CHECK (
    completed_at IS NULL OR paused_at IS NULL
  );

COMMENT ON COLUMN session_logs.paused_at IS
  'Instant the session was paused. NULL when running. Cleared on resume, at which point the elapsed pause is accumulated into total_paused_seconds.';
COMMENT ON COLUMN session_logs.total_paused_seconds IS
  'Accumulated pause time. Effective duration is (completed_at - started_at) minus this value.';

CREATE INDEX idx_session_logs_paused
  ON session_logs(athlete_id, paused_at)
  WHERE paused_at IS NOT NULL AND completed_at IS NULL AND NOT is_deleted;
