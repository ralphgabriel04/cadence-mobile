-- ============================================================================
-- 003 — Athlete-owned programs (ADR-004 decisions 1 and 2)
-- ============================================================================
--
-- WHY
-- The 2026 product is an autonomous athlete app with no coach. The canonical
-- schema cannot express that: programs.coach_id and program_assignments.coach_id
-- are both NOT NULL, and every policy reads `auth.uid() = coach_id`. An athlete
-- can therefore neither own a program nor assign one to themselves, which makes
-- template selection (cm#79) impossible to build.
--
-- WHAT
--   * programs.coach_id            -> nullable
--   * programs.created_by          -> new, nullable, references profiles
--   * programs.is_public           -> new, gates library visibility
--   * exercises.coach_id           -> nullable
--   * exercises.created_by         -> new, nullable
--   * exercises.is_public          -> new
--   * program_assignments.coach_id -> nullable (self-assignment)
--   * ownership CHECK constraints on programs and exercises
--   * athlete-side RLS policies on programs, exercises, sessions,
--     session_exercises and program_assignments
--   * indexes on the new ownership columns
--
-- DEVIATION FROM THE ORIGINAL BRIEF
-- The brief specified `created_by UUID NOT NULL`. That is incompatible with
-- ADR-004 decision 2: a seeded Cadence library template has no creator, so
-- NOT NULL would force a system account into profiles -- the phantom user that
-- decision 1 rejects. created_by is therefore nullable, and ownership is
-- guaranteed by CHECK instead: a row must have a coach, a creator, or be
-- public library content.
--
-- RLS ACYCLICITY
-- The policy reference graph before this migration:
--     programs             -> program_assignments
--     program_assignments  -> (nothing)
--     sessions             -> program_assignments, programs
--     session_exercises    -> sessions, program_assignments
--     exercise_logs        -> session_logs
-- This migration adds program_assignments INSERT -> programs. The resulting
-- chain terminates: program_assignments.INSERT reads programs.SELECT, which
-- reads program_assignments.SELECT, which references no table.
--
--   INVARIANT: program_assignments SELECT policies must never reference
--   programs. Doing so closes the loop into a true cycle and reintroduces the
--   recursion that the frozen web schema worked around with SECURITY DEFINER
--   in 004_fix_rls_recursion.sql. That workaround is deliberately NOT carried
--   over. If you need to widen program_assignments visibility, widen it on
--   columns of program_assignments itself.
--
-- No SECURITY DEFINER function is added by this migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROGRAMS — ownership columns
-- ----------------------------------------------------------------------------

ALTER TABLE programs
  ALTER COLUMN coach_id DROP NOT NULL;

ALTER TABLE programs
  ADD COLUMN created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: every pre-existing program was coach-owned, so the coach is also
-- its creator. Runs before the CHECK is added so existing rows satisfy it.
UPDATE programs SET created_by = coach_id WHERE created_by IS NULL;

ALTER TABLE programs
  ADD CONSTRAINT programs_has_owner CHECK (
    coach_id IS NOT NULL OR created_by IS NOT NULL OR is_public
  );

COMMENT ON COLUMN programs.coach_id IS
  'Owning coach. NULL for an athlete-created program or a Cadence library template.';
COMMENT ON COLUMN programs.created_by IS
  'Profile that created this program. NULL for seeded library content, which has no author row.';
COMMENT ON COLUMN programs.is_public IS
  'TRUE makes the program readable by every authenticated user. Used for the Cadence template library. Distinct from is_template: a coach may hold private templates.';
COMMENT ON CONSTRAINT programs_has_owner ON programs IS
  'Every program is owned by a coach, owned by a creator, or is public library content. Prevents orphan rows reachable by nobody.';

CREATE INDEX idx_programs_created_by ON programs(created_by) WHERE NOT is_deleted;
CREATE INDEX idx_programs_public_templates ON programs(is_template, is_public)
  WHERE is_public AND is_template AND NOT is_deleted;

-- ----------------------------------------------------------------------------
-- 2. EXERCISES — ownership columns (ADR-004 decision 2)
-- ----------------------------------------------------------------------------

ALTER TABLE exercises
  ALTER COLUMN coach_id DROP NOT NULL;

ALTER TABLE exercises
  ADD COLUMN created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE exercises SET created_by = coach_id WHERE created_by IS NULL;

ALTER TABLE exercises
  ADD CONSTRAINT exercises_has_owner CHECK (
    coach_id IS NOT NULL OR created_by IS NOT NULL OR is_public
  );

COMMENT ON COLUMN exercises.coach_id IS
  'Owning coach. NULL for an athlete-created exercise or a seeded public exercise.';
COMMENT ON COLUMN exercises.created_by IS
  'Profile that created this exercise. NULL for seeded public exercises.';
COMMENT ON COLUMN exercises.is_public IS
  'TRUE makes the exercise readable by every authenticated user. The seeded Cadence exercise library is public so session_exercises can reference shared rows instead of duplicating them per athlete.';

CREATE INDEX idx_exercises_created_by ON exercises(created_by) WHERE NOT is_deleted;
CREATE INDEX idx_exercises_public ON exercises(is_public) WHERE is_public AND NOT is_deleted;

-- ----------------------------------------------------------------------------
-- 3. PROGRAM_ASSIGNMENTS — self-assignment
-- ----------------------------------------------------------------------------

ALTER TABLE program_assignments
  ALTER COLUMN coach_id DROP NOT NULL;

COMMENT ON COLUMN program_assignments.coach_id IS
  'Coach who made the assignment. NULL when the athlete assigned the program to themselves.';

-- ----------------------------------------------------------------------------
-- 4. RLS — programs
-- ----------------------------------------------------------------------------

-- An athlete manages the programs they created. FOR ALL so they can also
-- rename or archive their own copy of a started template (cm#81).
CREATE POLICY "Creators can CRUD their own programs"
  ON programs FOR ALL
  TO authenticated
  USING (auth.uid() = created_by AND NOT is_deleted)
  WITH CHECK (auth.uid() = created_by);

-- The Cadence template library. Read-only for everyone; nothing in the app
-- writes these rows, only the seed does.
CREATE POLICY "Anyone can read public templates"
  ON programs FOR SELECT
  TO authenticated
  USING (is_public AND is_template AND NOT is_deleted);

-- ----------------------------------------------------------------------------
-- 5. RLS — exercises
-- ----------------------------------------------------------------------------

CREATE POLICY "Creators can CRUD their own exercises"
  ON exercises FOR ALL
  TO authenticated
  USING (auth.uid() = created_by AND NOT is_deleted)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Anyone can read public exercises"
  ON exercises FOR SELECT
  TO authenticated
  USING (is_public AND NOT is_deleted);

-- ----------------------------------------------------------------------------
-- 6. RLS — sessions and session_exercises
-- ----------------------------------------------------------------------------
-- The existing athlete policies only cover sessions of ASSIGNED programs. Two
-- gaps remain: a program the athlete created but has not assigned yet, and a
-- public template they are previewing before starting it (cm#79 step 2).

CREATE POLICY "Creators can CRUD sessions in their own programs"
  ON sessions FOR ALL
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = sessions.program_id
        AND p.created_by = auth.uid()
        AND NOT p.is_deleted
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = sessions.program_id
        AND p.created_by = auth.uid()
        AND NOT p.is_deleted
    )
  );

CREATE POLICY "Anyone can read sessions of public templates"
  ON sessions FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = sessions.program_id
        AND p.is_public AND p.is_template
        AND NOT p.is_deleted
    )
  );

CREATE POLICY "Creators can CRUD session_exercises in their own programs"
  ON session_exercises FOR ALL
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN programs p ON p.id = s.program_id
      WHERE s.id = session_exercises.session_id
        AND p.created_by = auth.uid()
        AND NOT s.is_deleted
        AND NOT p.is_deleted
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN programs p ON p.id = s.program_id
      WHERE s.id = session_exercises.session_id
        AND p.created_by = auth.uid()
        AND NOT s.is_deleted
        AND NOT p.is_deleted
    )
  );

CREATE POLICY "Anyone can read session_exercises of public templates"
  ON session_exercises FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN programs p ON p.id = s.program_id
      WHERE s.id = session_exercises.session_id
        AND p.is_public AND p.is_template
        AND NOT s.is_deleted
        AND NOT p.is_deleted
    )
  );

-- ----------------------------------------------------------------------------
-- 7. RLS — program_assignments self-assignment
-- ----------------------------------------------------------------------------
-- The WITH CHECK subquery on programs is what stops athlete A from assigning
-- athlete B's private program: A simply cannot SELECT that row, so the EXISTS
-- fails and the INSERT is rejected. Visibility IS the authorisation rule here,
-- which is why no SECURITY DEFINER helper is needed.
--
-- Deliberately NOT `FOR ALL`: a separate UPDATE/DELETE policy keyed only on
-- athlete_id keeps program_assignments SELECT free of any reference to
-- programs, preserving the acyclicity invariant documented in the header.

CREATE POLICY "Athletes can self-assign a program they can read"
  ON program_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    athlete_id = auth.uid()
    AND coach_id IS NULL
    AND EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = program_assignments.program_id
        AND NOT p.is_deleted
    )
  );

CREATE POLICY "Athletes can update their own self-assignments"
  ON program_assignments FOR UPDATE
  TO authenticated
  USING (athlete_id = auth.uid() AND coach_id IS NULL AND NOT is_deleted)
  WITH CHECK (athlete_id = auth.uid() AND coach_id IS NULL);

CREATE POLICY "Athletes can delete their own self-assignments"
  ON program_assignments FOR DELETE
  TO authenticated
  USING (athlete_id = auth.uid() AND coach_id IS NULL);
