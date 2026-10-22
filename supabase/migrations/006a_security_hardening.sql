-- ============================================================================
-- 006a · Security hardening (review of PR #167, 2026-10-22)
--
-- Runs after 006_functions.sql and before 007. Forward-only: it does not edit
-- earlier migrations, so it is also safe on a database that already applied
-- them.
--
-- 1. coach_athletes: a coach could INSERT a row with status = 'active' and the
--    id of any athlete, without that athlete's consent. An active row opens the
--    athlete's session_logs, readiness_logs and profile to the coach. From now
--    on a coach can only invite (status 'pending'); only the athlete can make
--    the relationship active, and nobody can change the coach/athlete pair.
-- 2. recompute_exercise_pr() is SECURITY DEFINER and was executable by PUBLIC,
--    so any signed-in user could call it by RPC with another athlete's id and
--    rewrite is_pr on their rows. It is only meant to run from the trigger.
-- ============================================================================

-- ── 1. coach_athletes ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Coaches can manage their relationships" ON coach_athletes;

CREATE POLICY "Coaches can view their relationships"
  ON coach_athletes FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted);

-- A coach only ever creates an invitation. Activating it is the athlete's call.
CREATE POLICY "Coaches can invite athletes"
  ON coach_athletes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = coach_id
    AND coach_id <> athlete_id
    AND status = 'pending'
    AND accepted_at IS NULL
  );

CREATE POLICY "Coaches can update their relationships"
  ON coach_athletes FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Athletes can respond to their relationships"
  ON coach_athletes FOR UPDATE
  TO authenticated
  USING (auth.uid() = athlete_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Coaches can delete their relationships"
  ON coach_athletes FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- Policies cannot compare OLD and NEW, so the transition rules live here.
-- auth.uid() is NULL for service_role and background jobs, which are trusted.
CREATE OR REPLACE FUNCTION coach_athletes_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.coach_id IS DISTINCT FROM OLD.coach_id
     OR NEW.athlete_id IS DISTINCT FROM OLD.athlete_id THEN
    RAISE EXCEPTION 'coach_athletes: the coach/athlete pair cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF auth.uid() IS DISTINCT FROM NEW.athlete_id THEN
      RAISE EXCEPTION 'coach_athletes: only the athlete can accept the relationship'
        USING ERRCODE = '42501';
    END IF;
    NEW.accepted_at := COALESCE(NEW.accepted_at, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS coach_athletes_guard_upd ON coach_athletes;
CREATE TRIGGER coach_athletes_guard_upd
  BEFORE UPDATE ON coach_athletes
  FOR EACH ROW EXECUTE FUNCTION coach_athletes_guard();

-- ── 2. SECURITY DEFINER functions are not public RPC endpoints ───────────────

REVOKE ALL ON FUNCTION recompute_exercise_pr(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION exercise_logs_pr_trigger() FROM PUBLIC, anon, authenticated;
