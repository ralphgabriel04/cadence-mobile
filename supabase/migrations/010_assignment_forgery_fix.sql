-- ============================================================================
-- 010 -- Forged assignments opened other accounts' programs (cm#153, P0)
-- ============================================================================
-- P0: A could read B's program and sessions through a forged assignment, by
-- (1) UPDATE of own assignment's program_id, or (2) INSERT with coach_id = A
-- (the old coach FOR ALL policy). Fix: key columns frozen for clients;
-- self-assign only own/library programs; a coach needs an owned program AND an
-- active coach_athletes row. program_assignments SELECT never references programs.
-- ============================================================================

CREATE FUNCTION public.freeze_assignment_keys() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Not SECURITY DEFINER: current_user is the caller. Server roles may fix data.
  IF current_user IN ('anon', 'authenticated') AND (
       NEW.program_id IS DISTINCT FROM OLD.program_id OR
       NEW.athlete_id IS DISTINCT FROM OLD.athlete_id OR
       NEW.coach_id   IS DISTINCT FROM OLD.coach_id) THEN
    RAISE EXCEPTION 'program_id, athlete_id and coach_id of an assignment cannot be changed'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER program_assignments_freeze_keys
  BEFORE UPDATE ON program_assignments
  FOR EACH ROW EXECUTE FUNCTION public.freeze_assignment_keys();

DROP POLICY "Athletes can self-assign a program they can read" ON program_assignments;
CREATE POLICY "Athletes can self-assign their own or a library program"
  ON program_assignments FOR INSERT TO authenticated
  WITH CHECK (
    athlete_id = auth.uid() AND coach_id IS NULL
    AND EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = program_assignments.program_id AND NOT p.is_deleted
        AND (p.created_by = auth.uid() OR (p.is_public AND p.is_template))
    )
  );

DROP POLICY "Coaches can manage assignments for their programs" ON program_assignments;
CREATE POLICY "Coaches can view their assignments"
  ON program_assignments FOR SELECT TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted);
CREATE POLICY "Coaches can update their assignments"
  ON program_assignments FOR UPDATE TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = coach_id);
CREATE POLICY "Coaches can delete their assignments"
  ON program_assignments FOR DELETE TO authenticated
  USING (auth.uid() = coach_id);
CREATE POLICY "Coaches can assign their programs to their athletes"
  ON program_assignments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = coach_id
    AND EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = program_assignments.program_id AND NOT p.is_deleted
        AND (p.coach_id = auth.uid() OR p.created_by = auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.coach_id = auth.uid() AND ca.athlete_id = program_assignments.athlete_id
        AND ca.status = 'active' AND NOT ca.is_deleted
    )
  );