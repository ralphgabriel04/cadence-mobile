-- ============================================================================
-- An athlete reads the exercises of a program their coach assigned to them,
-- even when the coach keeps those exercises private (the usual case: every
-- earlier fixture used public exercises, which hid the gap). Seen on the local
-- stack on 2026-11-21: « Aujourd'hui » showed « 0 exercices » and the live
-- session had nothing to log.
-- ============================================================================

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('98989898-0000-0000-0000-0000000000c0', 'assigned-coach@test.local',
   '{"first_name":"Carla","last_name":"Coach","role":"coach"}'),
  ('98989898-0000-0000-0000-0000000000a1', 'assigned-athlete@test.local',
   '{"first_name":"Arno","last_name":"Assigned","role":"athlete"}'),
  ('98989898-0000-0000-0000-0000000000a2', 'assigned-outsider@test.local',
   '{"first_name":"Olga","last_name":"Outsider","role":"athlete"}');

INSERT INTO exercises (id, coach_id, created_by, is_public, name, category) VALUES
  ('98ee0001-0000-0000-0000-000000000001', '98989898-0000-0000-0000-0000000000c0', NULL, FALSE, 'Squat privé', 'strength'),
  ('98ee0002-0000-0000-0000-000000000002', '98989898-0000-0000-0000-0000000000c0', NULL, FALSE, 'Hors programme', 'strength');

INSERT INTO programs (id, coach_id, created_by, is_public, is_template, name, status, duration_weeks)
VALUES ('98aa0001-0000-0000-0000-000000000001', '98989898-0000-0000-0000-0000000000c0', NULL,
        FALSE, FALSE, 'Programme du coach', 'active', 1);
INSERT INTO sessions (id, program_id, name, day_of_week, week_number)
VALUES ('98bb0001-0000-0000-0000-000000000001', '98aa0001-0000-0000-0000-000000000001', 'Lundi', 1, 1);
INSERT INTO session_exercises (session_id, exercise_id, order_index, sets, reps)
VALUES ('98bb0001-0000-0000-0000-000000000001', '98ee0001-0000-0000-0000-000000000001', 0, 3, '8');
INSERT INTO coach_athletes (coach_id, athlete_id, status)
VALUES ('98989898-0000-0000-0000-0000000000c0', '98989898-0000-0000-0000-0000000000a1', 'active');
INSERT INTO program_assignments (id, program_id, athlete_id, coach_id, start_date, status)
VALUES ('98cc0001-0000-0000-0000-000000000001', '98aa0001-0000-0000-0000-000000000001',
        '98989898-0000-0000-0000-0000000000a1', '98989898-0000-0000-0000-0000000000c0',
        DATE '2026-08-17', 'active');

-- T98a: the assigned athlete reads the private exercise of their program, and
--       the today screen lists it (2026-08-17 is a Monday).
DO $$
DECLARE n INT; r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '98989898-0000-0000-0000-0000000000a1', true);
  SELECT count(*) INTO n FROM exercises WHERE id = '98ee0001-0000-0000-0000-000000000001';
  r := get_today_screen(DATE '2026-08-17');
  RESET ROLE;
  PERFORM rec('T98a assigned athlete reads the coach''s private exercise, and Today lists it',
              n = 1 AND jsonb_array_length(r->'today'->'session'->'exercises') = 1
                AND r->'today'->'session'->'exercises'->0->>'name' = 'Squat privé',
              'n=' || n || ' today=' || COALESCE(r->'today'->>'state', 'null'));
END $$;

-- T98b: only the exercises of the program: another private exercise of the
--       same coach stays hidden.
DO $$
DECLARE n INT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '98989898-0000-0000-0000-0000000000a1', true);
  SELECT count(*) INTO n FROM exercises WHERE id = '98ee0002-0000-0000-0000-000000000002';
  RESET ROLE;
  PERFORM rec('T98b the coach''s other private exercises stay hidden', n = 0, 'n=' || n);
END $$;

-- T98c: an athlete without the assignment sees nothing.
DO $$
DECLARE n INT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '98989898-0000-0000-0000-0000000000a2', true);
  SELECT count(*) INTO n FROM exercises WHERE id = '98ee0001-0000-0000-0000-000000000001';
  RESET ROLE;
  PERFORM rec('T98c an athlete without the assignment cannot read it', n = 0, 'n=' || n);
END $$;

-- T98d: reading is all: the athlete cannot rename the coach's exercise.
DO $$
DECLARE n INT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '98989898-0000-0000-0000-0000000000a1', true);
  UPDATE exercises SET name = 'pwned' WHERE id = '98ee0001-0000-0000-0000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM rec('T98d the assigned athlete cannot modify the exercise', n = 0, 'updated=' || n);
END $$;

-- T98e: once the assignment is removed, the exercise is hidden again.
UPDATE program_assignments SET is_deleted = TRUE, deleted_at = NOW()
 WHERE id = '98cc0001-0000-0000-0000-000000000001';
DO $$
DECLARE n INT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '98989898-0000-0000-0000-0000000000a1', true);
  SELECT count(*) INTO n FROM exercises WHERE id = '98ee0001-0000-0000-0000-000000000001';
  RESET ROLE;
  PERFORM rec('T98e a removed assignment hides the exercise again', n = 0, 'n=' || n);
END $$;
