-- ============================================================================
-- 008 -- Write-side isolation fixes found by the 2.5 isolation suite (cm#153)
-- ============================================================================
-- None of these let an account READ another account's data. They let an
-- account WRITE where it should not, which 2.5 treats as the same family:
--
--   1. programs / exercises: any signed-in account could set is_public = TRUE
--      (with is_template for programs) on its own row and so publish it to the
--      Cadence library every user reads. The "creator" policy only checked
--      created_by, the "coach" policy only coach_id.
--   2. programs / exercises: A could insert a row with coach_id = B. B's coach
--      policy then lets B read, edit and delete a row B never created.
--   3. session_logs: UPDATE only re-checked athlete_id, so A could repoint an
--      own log at a session A cannot read (the INSERT policy already refuses it,
--      see 004 FIX 4).
--
-- Library rows (is_public) are only ever written by the seed, which runs as
-- the database owner or service_role and bypasses RLS, so no policy needs to
-- allow is_public = TRUE. Existing migrations are not edited (ADR-004): each
-- policy is dropped and recreated here. Acyclicity from 003 is unchanged.
-- ============================================================================

DROP POLICY "Creators can CRUD their own programs" ON programs;
CREATE POLICY "Creators can CRUD their own programs"
  ON programs FOR ALL
  TO authenticated
  USING (auth.uid() = created_by AND NOT is_deleted)
  WITH CHECK (
    auth.uid() = created_by
    AND NOT is_public
    AND (coach_id IS NULL OR coach_id = auth.uid())
  );

DROP POLICY "Coaches can CRUD their programs" ON programs;
CREATE POLICY "Coaches can CRUD their programs"
  ON programs FOR ALL
  TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted)
  WITH CHECK (
    auth.uid() = coach_id
    AND NOT is_public
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY "Creators can CRUD their own exercises" ON exercises;
CREATE POLICY "Creators can CRUD their own exercises"
  ON exercises FOR ALL
  TO authenticated
  USING (auth.uid() = created_by AND NOT is_deleted)
  WITH CHECK (
    auth.uid() = created_by
    AND NOT is_public
    AND (coach_id IS NULL OR coach_id = auth.uid())
  );

DROP POLICY "Coaches can CRUD their exercises" ON exercises;
CREATE POLICY "Coaches can CRUD their exercises"
  ON exercises FOR ALL
  TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted)
  WITH CHECK (
    auth.uid() = coach_id
    AND NOT is_public
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY "Athletes can update their session logs" ON session_logs;
CREATE POLICY "Athletes can update their session logs"
  ON session_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = athlete_id AND NOT is_deleted)
  WITH CHECK (
    auth.uid() = athlete_id
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_logs.session_id
        AND NOT s.is_deleted
    )
  );