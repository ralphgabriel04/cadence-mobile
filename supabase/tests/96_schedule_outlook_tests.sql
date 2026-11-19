-- ============================================================================
-- get_schedule_outlook() — stories 4.2 (next session, programme terminé) and
-- 4.3 (session of each day of the week).
-- Depends on rec() and the public exercises of 90_rls_tests.sql.
-- 2026-08-17 is a Monday. Own athlete, so earlier files cannot interfere.
-- ============================================================================

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('96969696-9696-9696-9696-969696969696', 'outlook@test.local',
   '{"first_name":"Olivia","last_name":"Outlook","role":"athlete"}'),
  ('96969696-0000-0000-0000-000000000002', 'outlook-other@test.local',
   '{"first_name":"Otto","last_name":"Other","role":"athlete"}');

-- Two-week program: week 1 Mon + Thu, week 2 Tue only.
INSERT INTO programs (id, coach_id, created_by, is_public, is_template, name, status, duration_weeks)
VALUES ('96aa0001-0000-0000-0000-000000000001', NULL,
        '96969696-9696-9696-9696-969696969696', FALSE, FALSE, 'Deux semaines', 'active', 2);

INSERT INTO sessions (id, program_id, name, day_of_week, week_number, order_index, estimated_duration_minutes)
VALUES ('96bb0001-0000-0000-0000-000000000001', '96aa0001-0000-0000-0000-000000000001', 'S1 Lundi', 1, 1, 0, 45),
       ('96bb0002-0000-0000-0000-000000000002', '96aa0001-0000-0000-0000-000000000001', 'S1 Jeudi', 4, 1, 0, 50),
       ('96bb0003-0000-0000-0000-000000000003', '96aa0001-0000-0000-0000-000000000001', 'S2 Mardi', 2, 2, 0, 40);

INSERT INTO session_exercises (session_id, exercise_id, order_index, sets, reps)
VALUES ('96bb0001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 0, 3, '8'),
       ('96bb0001-0000-0000-0000-000000000001', 'aaaa0002-0000-0000-0000-000000000002', 1, 3, '8');

-- T96a: no assignment -> empty outlook, not "finished"
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-9696-9696-9696-969696969696', true);
  r := get_schedule_outlook(DATE '2026-08-18');
  RESET ROLE;
  PERFORM rec('T96a no assignment: no next session, not finished, no week sessions',
              (r->'nextSession') = 'null'::jsonb AND (r->>'programFinished')::boolean = FALSE
                AND jsonb_array_length(r->'weekSessions') = 0, r::text);
END $$;

DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-9696-9696-9696-969696969696', true);
  INSERT INTO program_assignments (program_id, athlete_id, coach_id, start_date, status)
  VALUES ('96aa0001-0000-0000-0000-000000000001', '96969696-9696-9696-9696-969696969696',
          NULL, DATE '2026-08-17', 'active');
  RESET ROLE;
END $$;

-- T96b: Tuesday of week 1 (rest day) -> next is Thursday the 20th
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-9696-9696-9696-969696969696', true);
  r := get_schedule_outlook(DATE '2026-08-18');
  RESET ROLE;
  PERFORM rec('T96b rest day: next session is Thursday of the same week',
              r->'nextSession'->>'name' = 'S1 Jeudi' AND r->'nextSession'->>'date' = '2026-08-20'
                AND (r->'nextSession'->>'dayOfWeek')::int = 4
                AND (r->>'programFinished')::boolean = FALSE, r::text);
  PERFORM rec('T96c week sessions: Monday and Thursday, with exercise count',
              jsonb_array_length(r->'weekSessions') = 2
                AND r->'weekSessions'->0->>'name' = 'S1 Lundi'
                AND (r->'weekSessions'->0->>'exerciseCount')::int = 2
                AND r->'weekSessions'->0->>'date' = '2026-08-17'
                AND r->'weekSessions'->1->>'name' = 'S1 Jeudi', r::text);
END $$;

-- T96d: Friday of week 1 -> next is next week's Tuesday (beyond the week)
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-9696-9696-9696-969696969696', true);
  r := get_schedule_outlook(DATE '2026-08-21');
  RESET ROLE;
  PERFORM rec('T96d next session is found next week (Tuesday 25th)',
              r->'nextSession'->>'name' = 'S2 Mardi' AND r->'nextSession'->>'date' = '2026-08-25', r::text);
END $$;

-- T96e: Wednesday of week 2 -> nothing left, programme terminé
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-9696-9696-9696-969696969696', true);
  r := get_schedule_outlook(DATE '2026-08-26');
  RESET ROLE;
  PERFORM rec('T96e after the last session: programFinished and no next session',
              (r->>'programFinished')::boolean = TRUE AND (r->'nextSession') = 'null'::jsonb, r::text);
END $$;

-- T96f: another athlete sees none of it
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-0000-0000-0000-000000000002', true);
  r := get_schedule_outlook(DATE '2026-08-18');
  RESET ROLE;
  PERFORM rec('T96f another account gets an empty outlook',
              (r->'nextSession') = 'null'::jsonb AND jsonb_array_length(r->'weekSessions') = 0, r::text);
END $$;

-- T96g: anon cannot call it
DO $$
DECLARE ok BOOLEAN := FALSE;
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM get_schedule_outlook(DATE '2026-08-18');
    RESET ROLE;
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE; ok := TRUE;
  END;
  PERFORM rec('T96g anon cannot execute get_schedule_outlook', ok);
END $$;
