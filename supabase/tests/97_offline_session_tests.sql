-- ============================================================================
-- Story 5.3 at the database: a session opened on the phone without network is
-- created later with the id the phone chose, idempotently, and only by its owner.
-- Uses the athlete and program of 96_schedule_outlook_tests.sql.
-- ============================================================================

-- T97a: the owner creates the log with a phone-chosen id; a second identical
--       insert (ON CONFLICT DO NOTHING, as the queue does) changes nothing.
DO $$
DECLARE n INT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-9696-9696-9696-969696969696', true);
  INSERT INTO session_logs (id, session_id, athlete_id, status, started_at)
  VALUES ('97970000-0000-4000-8000-000000000001', '96bb0001-0000-0000-0000-000000000001',
          '96969696-9696-9696-9696-969696969696', 'in_progress', TIMESTAMPTZ '2026-08-17 17:50+00')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO session_logs (id, session_id, athlete_id, status)
  VALUES ('97970000-0000-4000-8000-000000000001', '96bb0001-0000-0000-0000-000000000001',
          '96969696-9696-9696-9696-969696969696', 'in_progress')
  ON CONFLICT (id) DO NOTHING;
  SELECT count(*) INTO n FROM session_logs WHERE id = '97970000-0000-4000-8000-000000000001';
  RESET ROLE;
  PERFORM rec('T97a a phone-chosen session log id is created once, idempotently', n = 1, 'count=' || n);
EXCEPTION WHEN others THEN
  RESET ROLE;
  PERFORM rec('T97a a phone-chosen session log id is created once, idempotently', FALSE, SQLERRM);
END $$;

-- T97b: a set sent twice for the same slot is refused the second time (the
--       sender turns that into an update), so the base keeps it once.
DO $$
DECLARE n INT; dup BOOLEAN := FALSE;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-9696-9696-9696-969696969696', true);
  INSERT INTO exercise_logs (session_log_id, exercise_id, set_number, reps_completed, weight_kg)
  VALUES ('97970000-0000-4000-8000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 1, 10, 50);
  BEGIN
    INSERT INTO exercise_logs (session_log_id, exercise_id, set_number, reps_completed, weight_kg)
    VALUES ('97970000-0000-4000-8000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 1, 10, 50);
  EXCEPTION WHEN unique_violation THEN dup := TRUE;
  END;
  SELECT count(*) INTO n FROM exercise_logs
   WHERE session_log_id = '97970000-0000-4000-8000-000000000001' AND NOT is_deleted;
  RESET ROLE;
  PERFORM rec('T97b the same set sent twice is stored once', dup AND n = 1, 'dup=' || dup || ' n=' || n);
END $$;

-- T97c: another account cannot create a log in the athlete's name.
DO $$
DECLARE ok BOOLEAN := FALSE;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-0000-0000-0000-000000000002', true);
  BEGIN
    INSERT INTO session_logs (id, session_id, athlete_id, status)
    VALUES ('97970000-0000-4000-8000-000000000002', '96bb0001-0000-0000-0000-000000000001',
            '96969696-9696-9696-9696-969696969696', 'in_progress');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN ok := TRUE;
  END;
  RESET ROLE;
  PERFORM rec('T97c another account cannot open a session in the athlete''s name', ok);
END $$;

-- T97d: an abandoned open session can be closed by its owner (« completed »
--       with completed_at), which frees the one-open-session slot.
DO $$
DECLARE st TEXT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-9696-9696-9696-969696969696', true);
  UPDATE session_logs SET status = 'completed', completed_at = now()
   WHERE id = '97970000-0000-4000-8000-000000000001';
  INSERT INTO session_logs (id, session_id, athlete_id, status)
  VALUES ('97970000-0000-4000-8000-000000000003', '96bb0002-0000-0000-0000-000000000002',
          '96969696-9696-9696-9696-969696969696', 'in_progress');
  SELECT status::text INTO st FROM session_logs WHERE id = '97970000-0000-4000-8000-000000000001';
  RESET ROLE;
  PERFORM rec('T97d an abandoned session is closed and a new one can open', st = 'completed', st);
EXCEPTION WHEN others THEN
  RESET ROLE;
  PERFORM rec('T97d an abandoned session is closed and a new one can open', FALSE, SQLERRM);
END $$;

-- T97e: a set queued offline reaches the server before its session log. The
--       exercise_logs policy (WITH CHECK on session_logs) is evaluated before the
--       foreign key, so the owner gets insufficient_privilege (42501), not
--       foreign_key_violation (23503). The sender must create the log on 42501.
DO $$
DECLARE code TEXT := 'none';
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '96969696-9696-9696-9696-969696969696', true);
  BEGIN
    INSERT INTO exercise_logs (session_log_id, exercise_id, set_number, reps_completed, weight_kg)
    VALUES ('97970000-0000-4000-8000-0000000000e5', 'aaaa0001-0000-0000-0000-000000000001', 1, 10, 50);
  EXCEPTION WHEN others THEN code := SQLSTATE;
  END;
  RESET ROLE;
  PERFORM rec('T97e a set before its session log is refused with 42501 (RLS before FK)',
              code = '42501', 'sqlstate=' || code);
END $$;
