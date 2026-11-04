-- ============================================================================
-- 92 -- Isolation tests (cm#153, story 2.5): nobody else sees or changes my data
-- ============================================================================
-- For profiles, programs, sessions, session_logs (done workouts), exercise_logs
-- (sets) and program_assignments: one case per table and per operation
-- (select, insert, update, delete) for account A, account B and anon.
--
-- Every "blocked" case has a positive control next to it (A can do the same
-- thing on A's own row), so a pass cannot come from a broken fixture.
--
-- LIMIT: auth.uid() is a GUC stub (see 00_harness.sql). This proves the policy
-- logic, not Supabase's JWT handling.
--
-- Fixtures use their own ids and fake addresses only. Needs 90_ (rec()).
-- ============================================================================

CREATE TABLE iso_ids (key TEXT PRIMARY KEY, id UUID NOT NULL);
INSERT INTO iso_ids
SELECT k, md5('iso:' || k)::uuid
  FROM unnest(ARRAY['A','B','K','X','XB','PK','PA','PA2','PA3','PB','PT','SA','SA3','SB','ST',
                    'LA','LA2','LB','EA','EA2','EA3','EB','AA','AB']) AS k;

CREATE FUNCTION iso_id(p_key TEXT) RETURNS UUID LANGUAGE sql STABLE AS
$$ SELECT id FROM iso_ids WHERE key = p_key $$;

-- Runs one statement as a role and identity. {KEY} placeholders become ids.
-- Returns 'rows=N' or 'err=<SQLSTATE>'.
CREATE FUNCTION iso_run(p_role TEXT, p_uid UUID, p_sql TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE s TEXT := p_sql; k RECORD; n BIGINT;
BEGIN
  FOR k IN SELECT key, id FROM iso_ids LOOP
    s := replace(s, '{' || k.key || '}', k.id::text);
  END LOOP;
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  PERFORM set_config('test.uid', COALESCE(p_uid::text, ''), true);
  IF upper(left(ltrim(s), 6)) = 'SELECT' THEN
    EXECUTE s INTO n;
  ELSE
    EXECUTE s;
    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;
  RESET ROLE;
  RETURN 'rows=' || n;
EXCEPTION WHEN others THEN
  RESET ROLE;
  RETURN 'err=' || SQLSTATE;
END $$;

CREATE TABLE iso_cases (
  n SERIAL PRIMARY KEY, name TEXT, role TEXT, uid_key TEXT, sql TEXT, expect TEXT
);
-- expect: 'rows=N' exact | 'blocked' (0 rows or 42501) | 'denied' (42501 raised)
CREATE FUNCTION iso_case(p_name TEXT, p_who TEXT, p_sql TEXT, p_expect TEXT)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO iso_cases(name, role, uid_key, sql, expect)
  VALUES (p_name, CASE WHEN p_who = 'anon' THEN 'anon' ELSE 'authenticated' END,
          CASE WHEN p_who = 'anon' THEN NULL ELSE p_who END, p_sql, p_expect);
$$;

-- ── Fixtures (as superuser: RLS does not apply) ─────────────────────────────
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  (iso_id('A'), 'iso-a@test.local', '{"first_name":"IsoA","role":"athlete"}'),
  (iso_id('B'), 'iso-b@test.local', '{"first_name":"IsoB","role":"athlete"}'),
  (iso_id('K'), 'iso-k@test.local', '{"first_name":"IsoK","role":"coach"}');

INSERT INTO exercises (id, coach_id, created_by, is_public, name, category)
VALUES (iso_id('X'), NULL, NULL, TRUE, 'iso exercise', 'strength'),
       (iso_id('XB'), NULL, iso_id('B'), FALSE, 'iso B private', 'strength');

INSERT INTO programs (id, coach_id, created_by, is_public, is_template, name, status) VALUES
  (iso_id('PA'),  NULL, iso_id('A'), FALSE, FALSE, 'iso PA',  'active'),
  (iso_id('PA2'), NULL, iso_id('A'), FALSE, FALSE, 'iso PA2', 'active'),
  (iso_id('PA3'), NULL, iso_id('A'), FALSE, FALSE, 'iso PA3', 'active'),
  (iso_id('PB'),  NULL, iso_id('B'), FALSE, FALSE, 'iso PB',  'active'),
  (iso_id('PT'),  NULL, NULL,        TRUE,  TRUE,  'iso PT',  'active'),
  (iso_id('PK'),  iso_id('K'), iso_id('K'), FALSE, FALSE, 'iso PK', 'active');
INSERT INTO coach_athletes (coach_id, athlete_id, status) VALUES (iso_id('K'), iso_id('A'), 'active');

INSERT INTO sessions (id, program_id, name, order_index) VALUES
  (iso_id('SA'),  iso_id('PA'), 'iso SA',  0),
  (iso_id('SA3'), iso_id('PA'), 'iso SA3', 1),
  (iso_id('SB'),  iso_id('PB'), 'iso SB',  0),
  (iso_id('ST'),  iso_id('PT'), 'iso ST',  0);

INSERT INTO program_assignments (id, program_id, athlete_id, coach_id, start_date, status) VALUES
  (iso_id('AA'), iso_id('PA'), iso_id('A'), NULL, CURRENT_DATE, 'active'),
  (iso_id('AB'), iso_id('PB'), iso_id('B'), NULL, CURRENT_DATE, 'active');

INSERT INTO session_logs (id, session_id, athlete_id, status, completed_at) VALUES
  (iso_id('LA'),  iso_id('SA'), iso_id('A'), 'completed', NOW()),
  (iso_id('LA2'), iso_id('SA'), iso_id('A'), 'completed', NOW()),
  (iso_id('LB'),  iso_id('SB'), iso_id('B'), 'completed', NOW());

INSERT INTO exercise_logs (id, session_log_id, exercise_id, set_number, reps_completed, weight_kg) VALUES
  (iso_id('EA'),  iso_id('LA'),  iso_id('X'), 1, 8, 50),
  (iso_id('EA2'), iso_id('LA'),  iso_id('X'), 2, 8, 50),
  (iso_id('EA3'), iso_id('LA'),  iso_id('X'), 3, 8, 50),
  (iso_id('EB'),  iso_id('LB'),  iso_id('X'), 1, 8, 50);

\o /dev/null
-- ── Cases ───────────────────────────────────────────────────────────────────
-- profiles
SELECT iso_case('profiles select: A reads own (control)', 'A', $q$SELECT count(*) FROM profiles WHERE id='{A}'$q$, 'rows=1');
SELECT iso_case('profiles select: A reads B', 'A', $q$SELECT count(*) FROM profiles WHERE id='{B}'$q$, 'rows=0');
SELECT iso_case('profiles select: B reads A', 'B', $q$SELECT count(*) FROM profiles WHERE id='{A}'$q$, 'rows=0');
SELECT iso_case('profiles select: A sees only self among A,B', 'A', $q$SELECT count(*) FROM profiles WHERE id IN ('{A}','{B}')$q$, 'rows=1');
SELECT iso_case('profiles select: anon', 'anon', $q$SELECT count(*) FROM profiles$q$, 'blocked');
SELECT iso_case('profiles insert: A adds a profile', 'A', $q$INSERT INTO profiles(id,email) VALUES (gen_random_uuid(),'iso-x@test.local')$q$, 'denied');
SELECT iso_case('profiles insert: anon', 'anon', $q$INSERT INTO profiles(id,email) VALUES (gen_random_uuid(),'iso-y@test.local')$q$, 'denied');
SELECT iso_case('profiles update: A edits own bio (control)', 'A', $q$UPDATE profiles SET bio='iso own' WHERE id='{A}'$q$, 'rows=1');
SELECT iso_case('profiles update: A edits B', 'A', $q$UPDATE profiles SET bio='iso hacked' WHERE id='{B}'$q$, 'blocked');
SELECT iso_case('profiles update: anon', 'anon', $q$UPDATE profiles SET bio='iso hacked'$q$, 'blocked');
SELECT iso_case('profiles delete: A deletes B', 'A', $q$DELETE FROM profiles WHERE id='{B}'$q$, 'blocked');
SELECT iso_case('profiles delete: A deletes self (no API delete; see story 2.6)', 'A', $q$DELETE FROM profiles WHERE id='{A}'$q$, 'blocked');
SELECT iso_case('profiles delete: anon', 'anon', $q$DELETE FROM profiles$q$, 'blocked');
-- programs
SELECT iso_case('programs select: A reads own (control)', 'A', $q$SELECT count(*) FROM programs WHERE id='{PA}'$q$, 'rows=1');
SELECT iso_case('programs select: A reads B''s private', 'A', $q$SELECT count(*) FROM programs WHERE id='{PB}'$q$, 'rows=0');
SELECT iso_case('programs select: B reads A''s private', 'B', $q$SELECT count(*) FROM programs WHERE id='{PA}'$q$, 'rows=0');
SELECT iso_case('programs select: A reads public template (control)', 'A', $q$SELECT count(*) FROM programs WHERE id='{PT}'$q$, 'rows=1');
SELECT iso_case('programs select: anon', 'anon', $q$SELECT count(*) FROM programs$q$, 'blocked');
SELECT iso_case('programs insert: A creates own (control)', 'A', $q$INSERT INTO programs(created_by,name,status) VALUES ('{A}','iso new','draft')$q$, 'rows=1');
SELECT iso_case('programs insert: A creates one owned by B', 'A', $q$INSERT INTO programs(created_by,name,status) VALUES ('{B}','iso fake','draft')$q$, 'denied');
SELECT iso_case('programs insert: anon', 'anon', $q$INSERT INTO programs(created_by,name,status) VALUES ('{A}','iso anon','draft')$q$, 'denied');
SELECT iso_case('programs update: A renames own (control)', 'A', $q$UPDATE programs SET name='iso renamed' WHERE id='{PA}'$q$, 'rows=1');
SELECT iso_case('programs update: A renames B''s', 'A', $q$UPDATE programs SET name='iso hacked' WHERE id='{PB}'$q$, 'blocked');
SELECT iso_case('programs update: A takes over B''s', 'A', $q$UPDATE programs SET created_by='{A}' WHERE id='{PB}'$q$, 'blocked');
SELECT iso_case('programs update: A edits the public template', 'A', $q$UPDATE programs SET name='iso hacked' WHERE id='{PT}'$q$, 'blocked');
SELECT iso_case('programs update: A hands own program to B', 'A', $q$UPDATE programs SET created_by='{B}' WHERE id='{PA2}'$q$, 'denied');
SELECT iso_case('programs update: anon', 'anon', $q$UPDATE programs SET name='iso hacked'$q$, 'blocked');
SELECT iso_case('programs delete: A deletes B''s', 'A', $q$DELETE FROM programs WHERE id='{PB}'$q$, 'blocked');
SELECT iso_case('programs delete: A deletes the public template', 'A', $q$DELETE FROM programs WHERE id='{PT}'$q$, 'blocked');
SELECT iso_case('programs delete: anon', 'anon', $q$DELETE FROM programs$q$, 'blocked');
SELECT iso_case('programs delete: A deletes own (control)', 'A', $q$DELETE FROM programs WHERE id='{PA3}'$q$, 'rows=1');
-- sessions (program sessions)
SELECT iso_case('sessions select: A reads own (control)', 'A', $q$SELECT count(*) FROM sessions WHERE id='{SA}'$q$, 'rows=1');
SELECT iso_case('sessions select: A reads B''s', 'A', $q$SELECT count(*) FROM sessions WHERE id='{SB}'$q$, 'rows=0');
SELECT iso_case('sessions select: B reads A''s', 'B', $q$SELECT count(*) FROM sessions WHERE id='{SA}'$q$, 'rows=0');
SELECT iso_case('sessions select: A reads public template session (control)', 'A', $q$SELECT count(*) FROM sessions WHERE id='{ST}'$q$, 'rows=1');
SELECT iso_case('sessions select: anon', 'anon', $q$SELECT count(*) FROM sessions$q$, 'blocked');
SELECT iso_case('sessions insert: A into own program (control)', 'A', $q$INSERT INTO sessions(program_id,name) VALUES ('{PA}','iso new')$q$, 'rows=1');
SELECT iso_case('sessions insert: A into B''s program', 'A', $q$INSERT INTO sessions(program_id,name) VALUES ('{PB}','iso planted')$q$, 'denied');
SELECT iso_case('sessions insert: A into the public template', 'A', $q$INSERT INTO sessions(program_id,name) VALUES ('{PT}','iso planted')$q$, 'denied');
SELECT iso_case('sessions insert: anon', 'anon', $q$INSERT INTO sessions(program_id,name) VALUES ('{PA}','iso anon')$q$, 'denied');
SELECT iso_case('sessions update: A renames own (control)', 'A', $q$UPDATE sessions SET name='iso renamed' WHERE id='{SA}'$q$, 'rows=1');
SELECT iso_case('sessions update: A renames B''s', 'A', $q$UPDATE sessions SET name='iso hacked' WHERE id='{SB}'$q$, 'blocked');
SELECT iso_case('sessions update: A edits public template session', 'A', $q$UPDATE sessions SET name='iso hacked' WHERE id='{ST}'$q$, 'blocked');
SELECT iso_case('sessions update: A moves own session into B''s program', 'A', $q$UPDATE sessions SET program_id='{PB}' WHERE id='{SA}'$q$, 'denied');
SELECT iso_case('sessions update: anon', 'anon', $q$UPDATE sessions SET name='iso hacked'$q$, 'blocked');
SELECT iso_case('sessions delete: A deletes B''s', 'A', $q$DELETE FROM sessions WHERE id='{SB}'$q$, 'blocked');
SELECT iso_case('sessions delete: A deletes public template session', 'A', $q$DELETE FROM sessions WHERE id='{ST}'$q$, 'blocked');
SELECT iso_case('sessions delete: anon', 'anon', $q$DELETE FROM sessions$q$, 'blocked');
SELECT iso_case('sessions delete: A deletes own (control)', 'A', $q$DELETE FROM sessions WHERE id='{SA3}'$q$, 'rows=1');
-- session_logs (workouts done)
SELECT iso_case('session_logs select: A reads own (control)', 'A', $q$SELECT count(*) FROM session_logs WHERE id='{LA}'$q$, 'rows=1');
SELECT iso_case('session_logs select: A reads B''s', 'A', $q$SELECT count(*) FROM session_logs WHERE athlete_id='{B}'$q$, 'rows=0');
SELECT iso_case('session_logs select: B reads A''s', 'B', $q$SELECT count(*) FROM session_logs WHERE athlete_id='{A}'$q$, 'rows=0');
SELECT iso_case('session_logs select: anon', 'anon', $q$SELECT count(*) FROM session_logs$q$, 'blocked');
SELECT iso_case('session_logs insert: A own on own session (control)', 'A', $q$INSERT INTO session_logs(session_id,athlete_id,status,completed_at) VALUES ('{SA}','{A}','completed',NOW())$q$, 'rows=1');
SELECT iso_case('session_logs insert: A writes a log for B', 'A', $q$INSERT INTO session_logs(session_id,athlete_id,status,completed_at) VALUES ('{SA}','{B}','completed',NOW())$q$, 'denied');
SELECT iso_case('session_logs insert: A on a session A cannot see', 'A', $q$INSERT INTO session_logs(session_id,athlete_id,status,completed_at) VALUES ('{SB}','{A}','completed',NOW())$q$, 'denied');
SELECT iso_case('session_logs insert: anon', 'anon', $q$INSERT INTO session_logs(session_id,athlete_id,status,completed_at) VALUES ('{SA}','{A}','completed',NOW())$q$, 'denied');
SELECT iso_case('session_logs update: A edits own notes (control)', 'A', $q$UPDATE session_logs SET notes='iso own' WHERE id='{LA}'$q$, 'rows=1');
SELECT iso_case('session_logs update: A edits B''s', 'A', $q$UPDATE session_logs SET notes='iso hacked' WHERE id='{LB}'$q$, 'blocked');
SELECT iso_case('session_logs update: A gives own log to B', 'A', $q$UPDATE session_logs SET athlete_id='{B}' WHERE id='{LA}'$q$, 'denied');
SELECT iso_case('session_logs update: anon', 'anon', $q$UPDATE session_logs SET notes='iso hacked'$q$, 'blocked');
SELECT iso_case('session_logs delete: A deletes B''s', 'A', $q$DELETE FROM session_logs WHERE id='{LB}'$q$, 'blocked');
SELECT iso_case('session_logs delete: anon', 'anon', $q$DELETE FROM session_logs$q$, 'blocked');
SELECT iso_case('session_logs delete: A deletes own (control)', 'A', $q$DELETE FROM session_logs WHERE id='{LA2}'$q$, 'rows=1');
-- exercise_logs (sets)
SELECT iso_case('exercise_logs select: A reads own (control)', 'A', $q$SELECT count(*) FROM exercise_logs WHERE id='{EA}'$q$, 'rows=1');
SELECT iso_case('exercise_logs select: A reads B''s', 'A', $q$SELECT count(*) FROM exercise_logs WHERE id='{EB}'$q$, 'rows=0');
SELECT iso_case('exercise_logs select: B reads A''s', 'B', $q$SELECT count(*) FROM exercise_logs WHERE id='{EA}'$q$, 'rows=0');
SELECT iso_case('exercise_logs select: anon', 'anon', $q$SELECT count(*) FROM exercise_logs$q$, 'blocked');
SELECT iso_case('exercise_logs insert: A own set (control)', 'A', $q$INSERT INTO exercise_logs(session_log_id,exercise_id,set_number,reps_completed,weight_kg) VALUES ('{LA}','{X}',9,5,50)$q$, 'rows=1');
SELECT iso_case('exercise_logs insert: A adds a set to B''s workout', 'A', $q$INSERT INTO exercise_logs(session_log_id,exercise_id,set_number,reps_completed,weight_kg) VALUES ('{LB}','{X}',9,5,50)$q$, 'denied');
SELECT iso_case('exercise_logs insert: anon', 'anon', $q$INSERT INTO exercise_logs(session_log_id,exercise_id,set_number,reps_completed,weight_kg) VALUES ('{LA}','{X}',8,5,50)$q$, 'denied');
SELECT iso_case('exercise_logs update: A edits own (control)', 'A', $q$UPDATE exercise_logs SET reps_completed=9 WHERE id='{EA}'$q$, 'rows=1');
SELECT iso_case('exercise_logs update: A edits B''s', 'A', $q$UPDATE exercise_logs SET reps_completed=99 WHERE id='{EB}'$q$, 'blocked');
SELECT iso_case('exercise_logs update: A moves own set into B''s workout', 'A', $q$UPDATE exercise_logs SET session_log_id='{LB}' WHERE id='{EA}'$q$, 'denied');
SELECT iso_case('exercise_logs update: anon', 'anon', $q$UPDATE exercise_logs SET reps_completed=99$q$, 'blocked');
SELECT iso_case('exercise_logs delete: A deletes B''s', 'A', $q$DELETE FROM exercise_logs WHERE id='{EB}'$q$, 'blocked');
SELECT iso_case('exercise_logs delete: anon', 'anon', $q$DELETE FROM exercise_logs$q$, 'blocked');
SELECT iso_case('exercise_logs delete: A deletes own (control)', 'A', $q$DELETE FROM exercise_logs WHERE id='{EA3}'$q$, 'rows=1');
-- exercises (same ownership pattern as programs)
SELECT iso_case('exercises insert: A creates own (control)', 'A', $q$INSERT INTO exercises(created_by,name) VALUES ('{A}','iso ex')$q$, 'rows=1');
SELECT iso_case('exercises select: B reads own private (control)', 'B', $q$SELECT count(*) FROM exercises WHERE id='{XB}'$q$, 'rows=1');
SELECT iso_case('exercises select: A cannot read B''s private exercise', 'A', $q$SELECT count(*) FROM exercises WHERE id='{XB}'$q$, 'rows=0');-- program_assignments
SELECT iso_case('program_assignments select: A reads own (control)', 'A', $q$SELECT count(*) FROM program_assignments WHERE id='{AA}'$q$, 'rows=1');
SELECT iso_case('program_assignments select: A reads B''s', 'A', $q$SELECT count(*) FROM program_assignments WHERE id='{AB}'$q$, 'rows=0');
SELECT iso_case('program_assignments select: anon', 'anon', $q$SELECT count(*) FROM program_assignments$q$, 'blocked');
SELECT iso_case('program_assignments insert: A self-assigns public template (control)', 'A', $q$INSERT INTO program_assignments(program_id,athlete_id,start_date,status) VALUES ('{PT}','{A}',CURRENT_DATE,'active')$q$, 'rows=1');
SELECT iso_case('program_assignments insert: A assigns B a program', 'A', $q$INSERT INTO program_assignments(program_id,athlete_id,start_date,status) VALUES ('{PT}','{B}',CURRENT_DATE,'active')$q$, 'denied');
SELECT iso_case('program_assignments insert: A assigns B''s private program to self', 'A', $q$INSERT INTO program_assignments(program_id,athlete_id,start_date,status) VALUES ('{PB}','{A}',CURRENT_DATE,'active')$q$, 'denied');
SELECT iso_case('program_assignments insert: anon', 'anon', $q$INSERT INTO program_assignments(program_id,athlete_id,start_date,status) VALUES ('{PT}','{A}',CURRENT_DATE,'active')$q$, 'denied');
SELECT iso_case('program_assignments update: A edits own (control)', 'A', $q$UPDATE program_assignments SET end_date=CURRENT_DATE+30 WHERE id='{AA}'$q$, 'rows=1');
SELECT iso_case('program_assignments update: A edits B''s', 'A', $q$UPDATE program_assignments SET end_date=CURRENT_DATE WHERE id='{AB}'$q$, 'blocked');
SELECT iso_case('program_assignments update: anon', 'anon', $q$UPDATE program_assignments SET end_date=CURRENT_DATE$q$, 'blocked');
SELECT iso_case('program_assignments delete: A deletes B''s', 'A', $q$DELETE FROM program_assignments WHERE id='{AB}'$q$, 'blocked');
SELECT iso_case('program_assignments delete: anon', 'anon', $q$DELETE FROM program_assignments$q$, 'blocked');

-- forged assignments (P0 found in review): used to open another account's program
SELECT iso_case('program_assignments update: A repoints own assignment to B''s program', 'A', $q$UPDATE program_assignments SET program_id='{PB}' WHERE id='{AA}'$q$, 'denied');
SELECT iso_case('program_assignments update: A gives own assignment to B', 'A', $q$UPDATE program_assignments SET athlete_id='{B}' WHERE id='{AA}'$q$, 'denied');
SELECT iso_case('program_assignments insert: A forges coach_id=A on B''s program', 'A', $q$INSERT INTO program_assignments(program_id,athlete_id,coach_id,start_date) VALUES ('{PB}','{A}','{A}',CURRENT_DATE)$q$, 'denied');
SELECT iso_case('program_assignments insert: A forges coach_id=A on own program', 'A', $q$INSERT INTO program_assignments(program_id,athlete_id,coach_id,start_date) VALUES ('{PA}','{A}','{A}',CURRENT_DATE)$q$, 'denied');
SELECT iso_case('program_assignments insert: coach K assigns own program to consenting A (control)', 'K', $q$INSERT INTO program_assignments(program_id,athlete_id,coach_id,start_date) VALUES ('{PK}','{A}','{K}',CURRENT_DATE)$q$, 'rows=1');
SELECT iso_case('program_assignments insert: coach K assigns to B who never consented', 'K', $q$INSERT INTO program_assignments(program_id,athlete_id,coach_id,start_date) VALUES ('{PK}','{B}','{K}',CURRENT_DATE)$q$, 'denied');
SELECT iso_case('program_assignments insert: coach K assigns a program K does not own', 'K', $q$INSERT INTO program_assignments(program_id,athlete_id,coach_id,start_date) VALUES ('{PA}','{A}','{K}',CURRENT_DATE)$q$, 'denied');
SELECT iso_case('program_assignments update: B repoints own assignment to A''s program', 'B', $q$UPDATE program_assignments SET program_id='{PA}' WHERE id='{AB}'$q$, 'denied');
SELECT iso_case('program_assignments insert: B forges coach_id=B on A''s program', 'B', $q$INSERT INTO program_assignments(program_id,athlete_id,coach_id,start_date) VALUES ('{PA}','{B}','{B}',CURRENT_DATE)$q$, 'denied');
SELECT iso_case('program_assignments insert: B assigns A a program', 'B', $q$INSERT INTO program_assignments(program_id,athlete_id,start_date) VALUES ('{PT}','{A}',CURRENT_DATE)$q$, 'denied');
SELECT iso_case('after the forgery attempts: A still cannot read B''s program', 'A', $q$SELECT count(*) FROM programs WHERE id='{PB}'$q$, 'rows=0');
SELECT iso_case('after the forgery attempts: A still cannot read B''s session', 'A', $q$SELECT count(*) FROM sessions WHERE id='{SB}'$q$, 'rows=0');
SELECT iso_case('after the forgery attempts: B still cannot read A''s program', 'B', $q$SELECT count(*) FROM programs WHERE id='{PA}'$q$, 'rows=0');
SELECT iso_case('after the forgery attempts: B still cannot read A''s session', 'B', $q$SELECT count(*) FROM sessions WHERE id='{SA}'$q$, 'rows=0');
\o
-- ── Run every case and record it ────────────────────────────────────────────
DO $$
DECLARE c RECORD; got TEXT; ok BOOLEAN;
BEGIN
  FOR c IN SELECT * FROM iso_cases ORDER BY n LOOP
    got := iso_run(c.role, (SELECT id FROM iso_ids WHERE key = c.uid_key), c.sql);
    ok := CASE c.expect
            WHEN 'blocked' THEN got IN ('rows=0', 'err=42501')
            WHEN 'denied'  THEN got = 'err=42501'
            ELSE got = c.expect
          END;
    PERFORM rec('ISO ' || c.name, ok, format('got %s, wanted %s', got, c.expect));
  END LOOP;
END $$;

-- ── B's data is untouched after every attack above ──────────────────────────
DO $$
DECLARE intact INT;
BEGIN
  SELECT (SELECT count(*) FROM profiles WHERE id = iso_id('B') AND bio IS DISTINCT FROM 'iso hacked')
       + (SELECT count(*) FROM programs WHERE id = iso_id('PB') AND name = 'iso PB' AND created_by = iso_id('B'))
       + (SELECT count(*) FROM sessions WHERE id = iso_id('SB') AND name = 'iso SB' AND program_id = iso_id('PB'))
       + (SELECT count(*) FROM session_logs WHERE id = iso_id('LB') AND notes IS NULL AND athlete_id = iso_id('B'))
       + (SELECT count(*) FROM exercise_logs WHERE id = iso_id('EB') AND reps_completed = 8 AND session_log_id = iso_id('LB'))
       + (SELECT count(*) FROM program_assignments WHERE id = iso_id('AB') AND end_date IS NULL)
    INTO intact;
  PERFORM rec('ISO B''s six rows are intact after all attacks', intact = 6, 'intact=' || intact);
END $$;

-- ── Every public table keeps RLS on (a new table cannot ship unprotected) ───
DO $$
DECLARE bad TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO bad
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
     AND c.relname NOT LIKE 'iso\_%' AND c.relname <> 'test_results';
  PERFORM rec('ISO every public table has row level security enabled', bad IS NULL,
              'without RLS: ' || COALESCE(bad, 'none'));
END $$;
