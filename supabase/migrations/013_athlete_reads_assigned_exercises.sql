-- ============================================================================
-- 013 — An athlete reads the exercises of the programs assigned to them.
-- ============================================================================
-- exercises only had three read paths: the coach who owns it, the athlete who
-- created it, and the public library. A coach's private exercise was therefore
-- invisible to the athlete it was programmed for: get_today_screen() (SECURITY
-- INVOKER) joined it away, so « Aujourd'hui » showed « 0 exercices » and the
-- live session (story 5.1) had nothing to log. Every SQL fixture used public
-- exercises, which hid it; found on the local stack on 2026-11-21.
--
-- Same reach as "Athletes can view session_exercises in assigned programs"
-- (001): an assignment of the athlete that is not deleted. Read only; the write
-- policies are unchanged. The subquery reads session_exercises, sessions and
-- program_assignments under their own RLS, none of which refers back to
-- exercises, so there is no policy recursion.
-- ============================================================================

CREATE POLICY "Athletes can view exercises in assigned programs"
  ON exercises FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1
        FROM session_exercises se
        JOIN sessions s ON s.id = se.session_id
        JOIN program_assignments pa ON pa.program_id = s.program_id
       WHERE se.exercise_id = exercises.id
         AND pa.athlete_id = auth.uid()
         AND NOT se.is_deleted
         AND NOT s.is_deleted
         AND NOT pa.is_deleted
    )
  );
