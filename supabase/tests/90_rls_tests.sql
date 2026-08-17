-- ============================================================================
-- RLS and trigger test suite for migrations 001 + 003..006
-- Runs against the disposable container. Not shipped.
-- ============================================================================

CREATE TABLE test_results (
  n SERIAL PRIMARY KEY,
  name TEXT,
  passed BOOLEAN,
  detail TEXT
);

CREATE OR REPLACE FUNCTION rec(p_name TEXT, p_passed BOOLEAN, p_detail TEXT DEFAULT '')
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO test_results(name, passed, detail) VALUES (p_name, p_passed, p_detail);
$$;

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Two athletes created through auth.users so handle_new_user() is exercised.

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a@test.local',
   '{"first_name":"Alice","last_name":"A","role":"athlete"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local',
   '{"first_name":"Bob","last_name":"B","role":"athlete"}'),
  -- deliberately invalid role: must fall back to athlete, not abort signup
  ('33333333-3333-3333-3333-333333333333', 'c@test.local',
   '{"first_name":"Carol","last_name":"C","role":""}');

-- Public Cadence library content (owned by nobody, is_public).
INSERT INTO exercises (id, coach_id, created_by, is_public, name, category)
VALUES ('aaaa0001-0000-0000-0000-000000000001', NULL, NULL, TRUE, 'Squat', 'strength'),
       ('aaaa0002-0000-0000-0000-000000000002', NULL, NULL, TRUE, 'Développé couché', 'strength');

INSERT INTO programs (id, coach_id, created_by, is_public, is_template, name, status)
VALUES ('bbbb0001-0000-0000-0000-000000000001', NULL, NULL, TRUE, TRUE, 'Full body débutant 3j', 'active');

INSERT INTO sessions (id, program_id, name, day_of_week, week_number, order_index)
VALUES ('cccc0001-0000-0000-0000-000000000001', 'bbbb0001-0000-0000-0000-000000000001',
        'Jour A', 1, 1, 0);

INSERT INTO session_exercises (id, session_id, exercise_id, order_index, sets, reps, rest_seconds)
VALUES ('dddd0001-0000-0000-0000-000000000001', 'cccc0001-0000-0000-0000-000000000001',
        'aaaa0001-0000-0000-0000-000000000001', 0, 3, '8-12', 90);

-- Bob's private program: Alice must never reach it.
INSERT INTO programs (id, coach_id, created_by, is_public, is_template, name, status)
VALUES ('bbbb0002-0000-0000-0000-000000000002', NULL,
        '22222222-2222-2222-2222-222222222222', FALSE, FALSE, 'Programme privé de Bob', 'active');

-- ── T1  handle_new_user created the profiles ─────────────────────────────────
DO $$
DECLARE c INT;
BEGIN
  SELECT count(*) INTO c FROM profiles
   WHERE id IN ('11111111-1111-1111-1111-111111111111',
                '22222222-2222-2222-2222-222222222222',
                '33333333-3333-3333-3333-333333333333');
  PERFORM rec('T1 handle_new_user creates a profile per auth user', c = 3, 'found ' || c);
END $$;

-- ── T2  an empty role falls back to athlete instead of aborting signup ───────
DO $$
DECLARE r TEXT;
BEGIN
  SELECT role::text INTO r FROM profiles WHERE id = '33333333-3333-3333-3333-333333333333';
  PERFORM rec('T2 invalid role in metadata falls back to athlete', r = 'athlete', 'role=' || COALESCE(r,'NULL'));
END $$;

-- ── T3  Alice creates a personal program (coach_id NULL) ─────────────────────
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  INSERT INTO programs (id, coach_id, created_by, name, status)
  VALUES ('eeee0001-0000-0000-0000-000000000001', NULL,
          '11111111-1111-1111-1111-111111111111', 'Mon programme', 'active');
  RESET ROLE;
  PERFORM rec('T3 athlete creates a coachless personal program', TRUE);
EXCEPTION WHEN others THEN
  RESET ROLE;
  PERFORM rec('T3 athlete creates a coachless personal program', FALSE, SQLERRM);
END $$;

-- ── T4  Alice self-assigns her own program ───────────────────────────────────
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  INSERT INTO program_assignments (program_id, athlete_id, coach_id, start_date, status)
  VALUES ('eeee0001-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', NULL, CURRENT_DATE, 'active');
  RESET ROLE;
  PERFORM rec('T4 athlete self-assigns their own program', TRUE);
EXCEPTION WHEN others THEN
  RESET ROLE;
  PERFORM rec('T4 athlete self-assigns their own program', FALSE, SQLERRM);
END $$;

-- ── T5  Alice CANNOT assign Bob's private program ───────────────────────────
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  INSERT INTO program_assignments (program_id, athlete_id, coach_id, start_date, status)
  VALUES ('bbbb0002-0000-0000-0000-000000000002',
          '11111111-1111-1111-1111-111111111111', NULL, CURRENT_DATE, 'active');
  RESET ROLE;
  PERFORM rec('T5 athlete cannot self-assign another athlete''s private program', FALSE,
              'INSERT succeeded and should not have');
EXCEPTION WHEN insufficient_privilege THEN
  RESET ROLE;
  PERFORM rec('T5 athlete cannot self-assign another athlete''s private program', TRUE);
WHEN others THEN
  RESET ROLE;
  PERFORM rec('T5 athlete cannot self-assign another athlete''s private program', FALSE, SQLERRM);
END $$;

-- ── T6  Alice cannot see Bob's private program ──────────────────────────────
DO $$
DECLARE c INT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  SELECT count(*) INTO c FROM programs WHERE id = 'bbbb0002-0000-0000-0000-000000000002';
  RESET ROLE;
  PERFORM rec('T6 athlete cannot read another athlete''s program', c = 0, 'rows=' || c);
END $$;

-- ── T7  Alice can read the public template and its contents ─────────────────
DO $$
DECLARE cp INT; cs INT; cse INT; cex INT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  SELECT count(*) INTO cp  FROM programs WHERE id = 'bbbb0001-0000-0000-0000-000000000001';
  SELECT count(*) INTO cs  FROM sessions WHERE program_id = 'bbbb0001-0000-0000-0000-000000000001';
  SELECT count(*) INTO cse FROM session_exercises WHERE session_id = 'cccc0001-0000-0000-0000-000000000001';
  SELECT count(*) INTO cex FROM exercises WHERE is_public;
  RESET ROLE;
  PERFORM rec('T7 athlete reads public template, its sessions, exercises',
              cp = 1 AND cs = 1 AND cse = 1 AND cex = 2,
              format('program=%s sessions=%s session_exercises=%s exercises=%s', cp, cs, cse, cex));
END $$;

-- ── T8  Alice cannot read Bob's profile; can read her own ───────────────────
DO $$
DECLARE own INT; other INT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  SELECT count(*) INTO own   FROM profiles WHERE id = '11111111-1111-1111-1111-111111111111';
  SELECT count(*) INTO other FROM profiles WHERE id = '22222222-2222-2222-2222-222222222222';
  RESET ROLE;
  PERFORM rec('T8 profiles: own readable, unrelated athlete not',
              own = 1 AND other = 0, format('own=%s other=%s', own, other));
END $$;

-- ── T9  Alice cannot promote herself to coach ───────────────────────────────
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  UPDATE profiles SET role = 'coach' WHERE id = '11111111-1111-1111-1111-111111111111';
  RESET ROLE;
  PERFORM rec('T9 athlete cannot change their own role', FALSE, 'UPDATE succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  RESET ROLE;
  PERFORM rec('T9 athlete cannot change their own role', TRUE);
WHEN others THEN
  RESET ROLE;
  PERFORM rec('T9 athlete cannot change their own role', FALSE, SQLERRM);
END $$;

-- ── T10  Alice can still update a harmless profile field ────────────────────
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  UPDATE profiles SET bio = 'coureuse' WHERE id = '11111111-1111-1111-1111-111111111111';
  RESET ROLE;
  PERFORM rec('T10 athlete can still edit their own bio', TRUE);
EXCEPTION WHEN others THEN
  RESET ROLE;
  PERFORM rec('T10 athlete can still edit their own bio', FALSE, SQLERRM);
END $$;

-- ── T11  session_log against a readable session succeeds ───────────────────
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  INSERT INTO session_logs (id, session_id, athlete_id, status)
  VALUES ('ffff0001-0000-0000-0000-000000000001',
          'cccc0001-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'in_progress');
  RESET ROLE;
  PERFORM rec('T11 athlete logs a session they can read', TRUE);
EXCEPTION WHEN others THEN
  RESET ROLE;
  PERFORM rec('T11 athlete logs a session they can read', FALSE, SQLERRM);
END $$;

-- ── T12  a second concurrent in-progress log is refused ────────────────────
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  INSERT INTO session_logs (session_id, athlete_id, status)
  VALUES ('cccc0001-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'in_progress');
  RESET ROLE;
  PERFORM rec('T12 only one in-progress session per athlete', FALSE, 'second INSERT succeeded');
EXCEPTION WHEN unique_violation THEN
  RESET ROLE;
  PERFORM rec('T12 only one in-progress session per athlete', TRUE);
WHEN others THEN
  RESET ROLE;
  PERFORM rec('T12 only one in-progress session per athlete', FALSE, SQLERRM);
END $$;

-- ── T13  logging a set twice is refused (idempotency key) ──────────────────
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  INSERT INTO exercise_logs (session_log_id, exercise_id, set_number, reps_completed, weight_kg)
  VALUES ('ffff0001-0000-0000-0000-000000000001','aaaa0001-0000-0000-0000-000000000001',1,10,60);
  INSERT INTO exercise_logs (session_log_id, exercise_id, set_number, reps_completed, weight_kg)
  VALUES ('ffff0001-0000-0000-0000-000000000001','aaaa0001-0000-0000-0000-000000000001',1,10,60);
  RESET ROLE;
  PERFORM rec('T13 duplicate set rejected, retry queue is idempotent', FALSE, 'duplicate accepted');
EXCEPTION WHEN unique_violation THEN
  RESET ROLE;
  PERFORM rec('T13 duplicate set rejected, retry queue is idempotent', TRUE);
WHEN others THEN
  RESET ROLE;
  PERFORM rec('T13 duplicate set rejected, retry queue is idempotent', FALSE, SQLERRM);
END $$;

-- ── T14  PR trigger marks the heaviest set ─────────────────────────────────
DO $$
DECLARE pr_weight NUMERIC; pr_count INT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  INSERT INTO exercise_logs (session_log_id, exercise_id, set_number, reps_completed, weight_kg)
  VALUES ('ffff0001-0000-0000-0000-000000000001','aaaa0001-0000-0000-0000-000000000001',2,8,80),
         ('ffff0001-0000-0000-0000-000000000001','aaaa0001-0000-0000-0000-000000000001',3,5,100),
         ('ffff0001-0000-0000-0000-000000000001','aaaa0001-0000-0000-0000-000000000001',4,3,90);
  RESET ROLE;
  SELECT count(*) INTO pr_count FROM exercise_logs
   WHERE exercise_id='aaaa0001-0000-0000-0000-000000000001' AND is_pr AND NOT is_deleted;
  SELECT weight_kg INTO pr_weight FROM exercise_logs
   WHERE exercise_id='aaaa0001-0000-0000-0000-000000000001' AND is_pr AND NOT is_deleted;
  PERFORM rec('T14 PR trigger marks exactly the heaviest set',
              pr_count = 1 AND pr_weight = 100, format('count=%s weight=%s', pr_count, pr_weight));
END $$;

-- ── T15  soft-deleting the record holder restores the previous record ──────
DO $$
DECLARE pr_weight NUMERIC; pr_count INT;
BEGIN
  UPDATE exercise_logs SET is_deleted = TRUE, deleted_at = NOW()
   WHERE exercise_id='aaaa0001-0000-0000-0000-000000000001' AND weight_kg = 100;
  SELECT count(*) INTO pr_count FROM exercise_logs
   WHERE exercise_id='aaaa0001-0000-0000-0000-000000000001' AND is_pr AND NOT is_deleted;
  SELECT weight_kg INTO pr_weight FROM exercise_logs
   WHERE exercise_id='aaaa0001-0000-0000-0000-000000000001' AND is_pr AND NOT is_deleted;
  PERFORM rec('T15 deleting the PR holder promotes the next heaviest',
              pr_count = 1 AND pr_weight = 90, format('count=%s weight=%s', pr_count, pr_weight));
END $$;

-- ── T16  correcting a set downward clears a false PR ──────────────────────
DO $$
DECLARE pr_weight NUMERIC;
BEGIN
  -- the 90 kg row was fat-fingered; it was really 9 kg
  UPDATE exercise_logs SET weight_kg = 9
   WHERE exercise_id='aaaa0001-0000-0000-0000-000000000001' AND weight_kg = 90 AND NOT is_deleted;
  SELECT weight_kg INTO pr_weight FROM exercise_logs
   WHERE exercise_id='aaaa0001-0000-0000-0000-000000000001' AND is_pr AND NOT is_deleted;
  PERFORM rec('T16 correcting a set downward moves the PR to the real best',
              pr_weight = 80, 'weight=' || COALESCE(pr_weight::text,'NULL'));
END $$;

-- ── T17  get_last_exercise_performance only ever returns own data ─────────
DO $$
DECLARE mine INT; bobs INT;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  SELECT count(*) INTO mine FROM get_last_exercise_performance('aaaa0001-0000-0000-0000-000000000001');
  PERFORM set_config('test.uid', '22222222-2222-2222-2222-222222222222', true);
  SELECT count(*) INTO bobs FROM get_last_exercise_performance('aaaa0001-0000-0000-0000-000000000001');
  RESET ROLE;
  -- Alice's session is not completed yet, so even she gets 0 rows; the point is
  -- that Bob cannot see Alice's data under any circumstance.
  PERFORM rec('T17 get_last_exercise_performance is scoped to the caller',
              bobs = 0, format('alice=%s bob=%s', mine, bobs));
END $$;

-- ── T18  completing a session: status and completed_at stay consistent ────
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
  UPDATE session_logs SET completed_at = NOW()
   WHERE id = 'ffff0001-0000-0000-0000-000000000001';
  RESET ROLE;
  PERFORM rec('T18 completed_at without status=completed is refused', FALSE, 'UPDATE succeeded');
EXCEPTION WHEN check_violation THEN
  RESET ROLE;
  PERFORM rec('T18 completed_at without status=completed is refused', TRUE);
WHEN others THEN
  RESET ROLE;
  PERFORM rec('T18 completed_at without status=completed is refused', FALSE, SQLERRM);
END $$;

-- ── T19  waitlist: anon inserts, cannot read ──────────────────────────────
DO $$
BEGIN
  SET LOCAL ROLE anon;
  INSERT INTO waitlist_subscribers (email) VALUES ('someone@example.com');
  RESET ROLE;
  PERFORM rec('T19a anon can join the waitlist', TRUE);
EXCEPTION WHEN others THEN
  RESET ROLE;
  PERFORM rec('T19a anon can join the waitlist', FALSE, SQLERRM);
END $$;

DO $$
DECLARE c INT;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO c FROM waitlist_subscribers;
  RESET ROLE;
  PERFORM rec('T19b anon cannot read the subscriber list', c = 0, 'rows=' || c);
END $$;

-- ── T20  the public counter works without exposing rows ──────────────────
DO $$
DECLARE n BIGINT;
BEGIN
  SET LOCAL ROLE anon;
  SELECT get_waitlist_count() INTO n;
  RESET ROLE;
  PERFORM rec('T20 anon can read the waitlist count via the function', n = 1, 'count=' || n);
EXCEPTION WHEN others THEN
  RESET ROLE;
  PERFORM rec('T20 anon can read the waitlist count via the function', FALSE, SQLERRM);
END $$;

-- ── T21  a malformed waitlist email is refused ───────────────────────────
DO $$
BEGIN
  SET LOCAL ROLE anon;
  INSERT INTO waitlist_subscribers (email) VALUES ('@x');
  RESET ROLE;
  PERFORM rec('T21 malformed waitlist email refused', FALSE, 'accepted');
EXCEPTION WHEN insufficient_privilege THEN
  RESET ROLE;
  PERFORM rec('T21 malformed waitlist email refused', TRUE);
WHEN others THEN
  RESET ROLE;
  PERFORM rec('T21 malformed waitlist email refused', FALSE, SQLERRM);
END $$;

-- ── T22  program_week_number ─────────────────────────────────────────────
DO $$
DECLARE w1 INT; w2 INT; w3 INT;
BEGIN
  w1 := program_week_number(DATE '2026-08-17', DATE '2026-08-17');
  w2 := program_week_number(DATE '2026-08-17', DATE '2026-08-23');
  w3 := program_week_number(DATE '2026-08-17', DATE '2026-08-24');
  PERFORM rec('T22 program_week_number is 1-based and rolls on day 8',
              w1 = 1 AND w2 = 1 AND w3 = 2, format('%s/%s/%s', w1, w2, w3));
END $$;

-- ── T23  ownership CHECK rejects a fully orphan program ──────────────────
DO $$
BEGIN
  INSERT INTO programs (coach_id, created_by, is_public, name, status)
  VALUES (NULL, NULL, FALSE, 'orphelin', 'draft');
  PERFORM rec('T23 a program with no owner at all is refused', FALSE, 'accepted');
EXCEPTION WHEN check_violation THEN
  PERFORM rec('T23 a program with no owner at all is refused', TRUE);
WHEN others THEN
  PERFORM rec('T23 a program with no owner at all is refused', FALSE, SQLERRM);
END $$;

-- ── Report ───────────────────────────────────────────────────────────────
SELECT CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS r,
       name,
       CASE WHEN passed THEN '' ELSE detail END AS detail
  FROM test_results ORDER BY n;

SELECT count(*) FILTER (WHERE passed) AS passed,
       count(*) FILTER (WHERE NOT passed) AS failed,
       count(*) AS total
  FROM test_results;
