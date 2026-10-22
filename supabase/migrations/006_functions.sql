-- ============================================================================
-- 006 — Functions: exercise history, personal records, waitlist count
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: which week of a program a date falls in
-- ----------------------------------------------------------------------------
-- sessions.week_number is 1-based. An assignment that started today is in
-- week 1. IMMUTABLE so it can be used in index expressions and inlined.

CREATE OR REPLACE FUNCTION program_week_number(p_start_date DATE, p_on_date DATE)
RETURNS INTEGER AS $$
  SELECT CASE
    WHEN p_start_date IS NULL OR p_on_date IS NULL THEN NULL
    WHEN p_on_date < p_start_date THEN NULL
    ELSE (p_on_date - p_start_date) / 7 + 1
  END;
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION program_week_number(DATE, DATE) IS
  '1-based program week for a date, given the assignment start date. NULL before the program starts.';

-- ----------------------------------------------------------------------------
-- get_last_exercise_performance — the athlete's most recent sets on an exercise
-- ----------------------------------------------------------------------------
-- Ported from the frozen schema's 013_exercise_types_and_cardio.sql with three
-- deliberate changes:
--
--   1. NO p_athlete_id parameter. The frozen version took the athlete as an
--      argument AND was SECURITY DEFINER, so any authenticated caller could
--      read any athlete's training history by passing their id. The athlete is
--      now derived from auth.uid().
--
--   2. SECURITY INVOKER (the default). RLS on exercise_logs and session_logs
--      applies, so the function cannot return more than the caller could read
--      with a plain query. This is what makes dropping the parameter sufficient
--      rather than merely cosmetic.
--
--   3. Canonical column names and units. The frozen schema stored distance_km
--      and duration_minutes; the canonical schema stores distance_meters and
--      duration_seconds. exercise_logs also has no athlete_id column here, so
--      the athlete is reached through session_logs.
--
-- Returns every set of the most recent completed session in which the exercise
-- appears, not just one row -- the logging screen shows "last time: 3 x 8 @ 80"
-- and needs the whole set list.

CREATE OR REPLACE FUNCTION get_last_exercise_performance(p_exercise_id UUID)
RETURNS TABLE (
  log_id UUID,
  session_log_id UUID,
  performed_at TIMESTAMPTZ,
  set_number INTEGER,
  reps_completed INTEGER,
  weight_kg NUMERIC,
  rpe INTEGER,
  duration_seconds INTEGER,
  distance_meters NUMERIC,
  is_pr BOOLEAN
) AS $$
  WITH last_session AS (
    SELECT sl.id, sl.completed_at
      FROM exercise_logs el
      JOIN session_logs sl ON sl.id = el.session_log_id
     WHERE el.exercise_id = p_exercise_id
       AND sl.athlete_id = auth.uid()
       AND sl.completed_at IS NOT NULL
       AND NOT el.is_deleted
       AND NOT sl.is_deleted
     ORDER BY sl.completed_at DESC
     LIMIT 1
  )
  SELECT el.id,
         el.session_log_id,
         ls.completed_at,
         el.set_number,
         el.reps_completed,
         el.weight_kg,
         el.rpe,
         el.duration_seconds,
         el.distance_meters,
         el.is_pr
    FROM exercise_logs el
    JOIN last_session ls ON ls.id = el.session_log_id
   WHERE el.exercise_id = p_exercise_id
     AND NOT el.is_deleted
   ORDER BY el.set_number;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_last_exercise_performance(UUID) IS
  'All sets the calling athlete logged for an exercise in their most recent completed session containing it. SECURITY INVOKER: RLS applies, so the caller can only ever see their own logs.';

-- ----------------------------------------------------------------------------
-- get_exercise_history — one row per completed session, for the history view
-- ----------------------------------------------------------------------------
-- Aggregated per session so the history screen (cm#29) can render a list and a
-- progression chart without pulling every set. Same security model as above.

CREATE OR REPLACE FUNCTION get_exercise_history(
  p_exercise_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  session_log_id UUID,
  performed_at TIMESTAMPTZ,
  session_name TEXT,
  set_count BIGINT,
  total_reps BIGINT,
  max_weight_kg NUMERIC,
  total_volume_kg NUMERIC,
  avg_rpe NUMERIC,
  had_pr BOOLEAN
) AS $$
  SELECT sl.id,
         sl.completed_at,
         s.name,
         count(*),
         COALESCE(sum(el.reps_completed), 0),
         max(el.weight_kg),
         -- Volume counts only sets carrying both a weight and a rep count.
         COALESCE(sum(el.weight_kg * el.reps_completed), 0),
         round(avg(el.rpe), 1),
         bool_or(el.is_pr)
    FROM exercise_logs el
    JOIN session_logs sl ON sl.id = el.session_log_id
    JOIN sessions s ON s.id = sl.session_id
   WHERE el.exercise_id = p_exercise_id
     AND sl.athlete_id = auth.uid()
     AND sl.completed_at IS NOT NULL
     AND NOT el.is_deleted
     AND NOT sl.is_deleted
   GROUP BY sl.id, sl.completed_at, s.name
   ORDER BY sl.completed_at DESC
   LIMIT GREATEST(p_limit, 1);
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_exercise_history(UUID, INTEGER) IS
  'Per-session summary of the calling athlete''s work on one exercise, newest first. SECURITY INVOKER.';

-- ----------------------------------------------------------------------------
-- Personal records (cm#31)
-- ----------------------------------------------------------------------------
-- WHAT COUNTS AS A PR, for this MVP: the heaviest weight_kg the athlete has
-- logged on that exercise, in a set with at least one completed rep.
--
-- One definition, chosen deliberately over the alternatives:
--   * estimated 1RM  -- needs a formula (Epley, Brzycki, Lombardi...). The
--     choice is contestable, the result is a derived number the athlete cannot
--     verify, and two formulas disagree on who holds the record.
--   * max volume in a set (weight x reps) -- rewards high-rep sets in a way
--     athletes do not read as a record.
--   * max reps at a given weight -- needs a reference weight per exercise,
--     which nothing in the schema supplies.
-- Max weight is the one an athlete recognises without explanation.
--
-- WHY A TRIGGER RATHER THAN CLIENT-SIDE:
-- Client-side detection is wrong the moment two devices, a retry, or an offline
-- queue replay are involved -- each client only sees its own writes and would
-- have to re-read history to decide, which is the trigger's job anyway. It also
-- cannot react to a correction it did not make.
--
-- WHY RECOMPUTE RATHER THAN MARK-ON-INSERT:
-- This is the case the brief asked about. Marking is_pr at INSERT is stable
-- only while history is append-only. It is not:
--   * a set edited downward (fat-fingered 100 instead of 10) leaves a false PR;
--   * a set soft-deleted leaves the record pointing at a row that no longer
--     counts, and the true record is never restored;
--   * an out-of-order write (offline queue flushed late) marks a lighter set as
--     a PR because the heavier one had not arrived yet.
-- So the trigger recomputes the PR for the affected (athlete, exercise) pair on
-- every INSERT, UPDATE and soft delete. The work is bounded by that athlete's
-- history for one exercise and is served by idx_exercise_logs_exercise_set.

CREATE OR REPLACE FUNCTION recompute_exercise_pr(p_athlete_id UUID, p_exercise_id UUID)
RETURNS VOID AS $$
DECLARE
  best_id UUID;
BEGIN
  -- Ties go to the earliest set: the record belongs to the session that first
  -- reached the weight, not the most recent one to match it.
  SELECT el.id INTO best_id
    FROM exercise_logs el
    JOIN session_logs sl ON sl.id = el.session_log_id
   WHERE el.exercise_id = p_exercise_id
     AND sl.athlete_id = p_athlete_id
     AND el.weight_kg IS NOT NULL
     AND COALESCE(el.reps_completed, 0) >= 1
     AND NOT el.is_deleted
     AND NOT sl.is_deleted
   ORDER BY el.weight_kg DESC, el.created_at ASC
   LIMIT 1;

  -- COALESCE and IS DISTINCT FROM are both load-bearing:
  --   * when no set qualifies any more (the record holder was deleted or edited
  --     below a rep count of 1), best_id is NULL. Without COALESCE, `el.id =
  --     best_id` evaluates to NULL rather than FALSE, the WHERE clause matches
  --     nothing, and a stale is_pr = TRUE is never cleared.
  --   * is_pr is nullable (DEFAULT FALSE, not NOT NULL), so `<>` against a NULL
  --     current value also yields NULL and skips the row.
  UPDATE exercise_logs el
     SET is_pr = COALESCE(el.id = best_id, FALSE)
    FROM session_logs sl
   WHERE sl.id = el.session_log_id
     AND el.exercise_id = p_exercise_id
     AND sl.athlete_id = p_athlete_id
     AND el.is_pr IS DISTINCT FROM COALESCE(el.id = best_id, FALSE);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- SECURITY DEFINER justification (required by project rule):
-- The recompute must UPDATE sibling rows of the row being written. Under the
-- caller's rights that UPDATE is filtered by RLS on exercise_logs, and its
-- WITH CHECK re-runs for each affected row, which makes correct bookkeeping
-- depend on policy details rather than on the invariant. The function is not
-- callable in a way that leaks data: it returns VOID, it takes the athlete id
-- from the triggering row rather than from the caller, and it only ever flips
-- is_pr within one (athlete, exercise) pair. search_path is pinned.

COMMENT ON FUNCTION recompute_exercise_pr(UUID, UUID) IS
  'Recomputes is_pr for one athlete/exercise pair: exactly one row carries TRUE, the earliest set holding the heaviest weight with at least one rep. Idempotent.';

CREATE OR REPLACE FUNCTION exercise_logs_pr_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_athlete_id UUID;
  v_exercise_id UUID;
BEGIN
  v_exercise_id := COALESCE(NEW.exercise_id, OLD.exercise_id);

  SELECT sl.athlete_id INTO v_athlete_id
    FROM session_logs sl
   WHERE sl.id = COALESCE(NEW.session_log_id, OLD.session_log_id);

  IF v_athlete_id IS NOT NULL AND v_exercise_id IS NOT NULL THEN
    PERFORM recompute_exercise_pr(v_athlete_id, v_exercise_id);
  END IF;

  -- If the exercise itself was changed on an existing row, the old exercise's
  -- record has to be recomputed too.
  IF TG_OP = 'UPDATE' AND OLD.exercise_id IS DISTINCT FROM NEW.exercise_id THEN
    PERFORM recompute_exercise_pr(v_athlete_id, OLD.exercise_id);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- AFTER, and guarded on the columns that can change the answer, so the trigger
-- does not re-enter on its own is_pr write.
CREATE TRIGGER exercise_logs_recompute_pr_ins
  AFTER INSERT ON exercise_logs
  FOR EACH ROW EXECUTE FUNCTION exercise_logs_pr_trigger();

CREATE TRIGGER exercise_logs_recompute_pr_upd
  AFTER UPDATE OF weight_kg, reps_completed, is_deleted, exercise_id, session_log_id
  ON exercise_logs
  FOR EACH ROW EXECUTE FUNCTION exercise_logs_pr_trigger();

CREATE TRIGGER exercise_logs_recompute_pr_del
  AFTER DELETE ON exercise_logs
  FOR EACH ROW EXECUTE FUNCTION exercise_logs_pr_trigger();

-- ----------------------------------------------------------------------------
-- get_personal_records — the athlete's current records, for the history screen
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_personal_records()
RETURNS TABLE (
  exercise_id UUID,
  exercise_name TEXT,
  weight_kg NUMERIC,
  reps_completed INTEGER,
  achieved_at TIMESTAMPTZ
) AS $$
  SELECT e.id,
         e.name,
         el.weight_kg,
         el.reps_completed,
         COALESCE(sl.completed_at, sl.started_at)
    FROM exercise_logs el
    JOIN session_logs sl ON sl.id = el.session_log_id
    JOIN exercises e ON e.id = el.exercise_id
   WHERE el.is_pr
     AND sl.athlete_id = auth.uid()
     AND NOT el.is_deleted
     AND NOT sl.is_deleted
   ORDER BY COALESCE(sl.completed_at, sl.started_at) DESC;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_personal_records() IS
  'Current personal records of the calling athlete, newest first. SECURITY INVOKER.';

-- ----------------------------------------------------------------------------
-- get_waitlist_count — the public counter, without exposing the list
-- ----------------------------------------------------------------------------
-- 004 removed SELECT on waitlist_subscribers for anon and authenticated because
-- the rows are personal data. The landing page still needs the count.

CREATE OR REPLACE FUNCTION get_waitlist_count()
RETURNS BIGINT AS $$
  SELECT count(*) FROM public.waitlist_subscribers;
$$ LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp;

-- SECURITY DEFINER justification (required by project rule):
-- The counter has to be readable by anon while the underlying rows must not be.
-- A definer function returning a single scalar is the narrowest way to expose
-- exactly the aggregate and nothing else: it takes no arguments, so there is no
-- filter an caller could use to turn it into a membership oracle. search_path
-- is pinned.

REVOKE ALL ON FUNCTION get_waitlist_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_waitlist_count() TO anon, authenticated;

COMMENT ON FUNCTION get_waitlist_count() IS
  'Number of waitlist subscribers, for the public landing page counter. SECURITY DEFINER because anon has no SELECT on the table; takes no arguments so it cannot be used to test whether a given email is present.';
