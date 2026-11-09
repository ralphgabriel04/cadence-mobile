-- ============================================================================
-- 93 -- Account deletion, database side (cm#154 part a, story 2.6)
-- ============================================================================
-- delete_my_account(): 0 rows left for the caller in every table, other accounts
-- untouched, no argument, closed to anon. LIMIT: auth.uid() and auth.users are
-- stubs (00_harness.sql); the real Supabase role is checked on the local stack.
-- ============================================================================

CREATE FUNCTION del_id(k TEXT) RETURNS UUID LANGUAGE sql IMMUTABLE AS
$$ SELECT md5('del:' || k)::uuid $$;

-- One row in every table that can hold a user's data, for user u ('A', 'B').
-- 'C' is a coach linked to both, 'D' is an empty bystander.
CREATE FUNCTION del_seed(u TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO exercises(id, created_by, is_public, name)
    VALUES (del_id(u||'ex'), del_id(u), FALSE, 'del ex');
  INSERT INTO programs(id, created_by, name, status)
    VALUES (del_id(u||'p'), del_id(u), 'del p', 'active');
  INSERT INTO sessions(id, program_id, name) VALUES (del_id(u||'s'), del_id(u||'p'), 'del s');
  INSERT INTO session_exercises(id, session_id, exercise_id, order_index)
    VALUES (del_id(u||'se'), del_id(u||'s'), del_id(u||'ex'), 0);
  INSERT INTO program_assignments(id, program_id, athlete_id, coach_id, start_date)
    VALUES (del_id(u||'pa'), del_id(u||'p'), del_id(u), NULL, CURRENT_DATE);
  INSERT INTO session_logs(id, session_id, athlete_id, status, completed_at)
    VALUES (del_id(u||'l'), del_id(u||'s'), del_id(u), 'completed', NOW());
  INSERT INTO exercise_logs(id, session_log_id, exercise_id, set_number, reps_completed, weight_kg)
    VALUES (del_id(u||'el'), del_id(u||'l'), del_id(u||'ex'), 1, 5, 40);
  INSERT INTO readiness_logs(athlete_id) VALUES (del_id(u));
  INSERT INTO session_images(session_log_id, athlete_id, image_url)
    VALUES (del_id(u||'l'), del_id(u), 'https://example.test/x.jpg');
  INSERT INTO coach_athletes(coach_id, athlete_id, status) VALUES (del_id('C'), del_id(u), 'active');
  INSERT INTO coach_notes(coach_id, athlete_id, session_log_id, content)
    VALUES (del_id('C'), del_id(u), del_id(u||'l'), 'del note');
  INSERT INTO conversations(id, coach_id, athlete_id) VALUES (del_id(u||'cv'), del_id('C'), del_id(u));
  INSERT INTO messages(id, conversation_id, sender_id, content) VALUES
    (del_id(u||'m1'), del_id(u||'cv'), del_id(u), 'hi'),
    (del_id(u||'m2'), del_id(u||'cv'), del_id('C'), 'yo');
  INSERT INTO waitlist_subscribers(email) VALUES ('del-' || lower(u) || '@test.local');
END $$;

-- Row counts for user u: direct ownership found from the FKs to profiles/auth.users
-- (a later table is counted automatically); child-only tables listed by id.
CREATE FUNCTION del_snapshot(u TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE r RECORD; n BIGINT; res JSONB := '{}'::jsonb;
BEGIN
  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND ns.nspname = 'public'
       AND c.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.t, r.col)
      INTO n USING del_id(u);
    res := res || jsonb_build_object(r.t || '.' || r.col, n);
  END LOOP;
  res := res || jsonb_build_object(
    'sessions',          (SELECT count(*) FROM sessions WHERE id = del_id(u||'s')),
    'session_exercises', (SELECT count(*) FROM session_exercises WHERE id = del_id(u||'se')),
    'exercise_logs',     (SELECT count(*) FROM exercise_logs WHERE id = del_id(u||'el')),
    'messages',          (SELECT count(*) FROM messages WHERE conversation_id = del_id(u||'cv')),
    'waitlist',          (SELECT count(*) FROM waitlist_subscribers WHERE email = 'del-' || lower(u) || '@test.local'),
    'auth.users',        (SELECT count(*) FROM auth.users WHERE id = del_id(u)));
  RETURN res;
END $$;

CREATE FUNCTION del_nonzero(s JSONB) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg(key || '=' || value, ', ' ORDER BY key)
    FROM jsonb_each_text(s) WHERE value::bigint > 0 $$;

-- Calls delete_my_account() as <role> with identity <uid>; returns 'ok' or the error.
CREATE FUNCTION del_call(p_role TEXT, p_uid TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  PERFORM set_config('test.uid', COALESCE(p_uid, ''), true);
  PERFORM public.delete_my_account();
  RESET ROLE;
  RETURN 'ok';
EXCEPTION WHEN others THEN
  RESET ROLE;
  RETURN SQLSTATE || ' ' || SQLERRM;
END $$;

-- ── Fixtures ────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  (del_id('A'), 'del-a@test.local', '{"role":"athlete"}'),
  (del_id('B'), 'del-b@test.local', '{"role":"athlete"}'),
  (del_id('C'), 'del-c@test.local', '{"role":"coach"}'),
  (del_id('D'), 'del-d@test.local', '{"role":"athlete"}');
\o /dev/null
SELECT del_seed('A'), del_seed('B');
\o

UPDATE auth.users SET email_confirmed_at = NOW() WHERE id IN (del_id('A'), del_id('B'), del_id('C'), del_id('D'));

-- E: e-mail changed in Auth after signup (the profile keeps the old one), confirmed.
-- F: e-mail never confirmed. G: coach, H: his athlete. Third-party waitlist row.
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (del_id('E'), 'del-e@test.local', NOW(), '{"role":"athlete"}'),
  (del_id('F'), 'del-f@test.local', NULL, '{"role":"athlete"}'),
  (del_id('G'), 'del-g@test.local', NOW(), '{"role":"coach"}'),
  (del_id('H'), 'del-h@test.local', NOW(), '{"role":"athlete"}');
UPDATE auth.users SET email = 'del-e-new@test.local' WHERE id = del_id('E');
INSERT INTO waitlist_subscribers(email) VALUES
  ('del-e-new@test.local'), ('del-e@test.local'), ('del-f@test.local'), ('del-third@test.local');

-- G's program, H's workout on it (used by the KNOWN LIMIT test).
INSERT INTO programs(id, coach_id, created_by, name, status) VALUES (del_id('Gp'), del_id('G'), del_id('G'), 'del gp', 'active');
INSERT INTO sessions(id, program_id, name) VALUES (del_id('Gs'), del_id('Gp'), 'del gs');
INSERT INTO session_logs(id, session_id, athlete_id, status, completed_at)
  VALUES (del_id('Hl'), del_id('Gs'), del_id('H'), 'completed', NOW());

-- Public library rows: must survive any deletion.
INSERT INTO programs(id, is_public, is_template, name, status) VALUES (del_id('Lib'), TRUE, TRUE, 'del library', 'active');
INSERT INTO exercises(id, is_public, name) VALUES (del_id('LibEx'), TRUE, 'del library ex');

-- Rows of B that point at A's rows through the four ON DELETE SET NULL keys.
INSERT INTO session_logs(id, session_id, athlete_id, status, completed_at, program_assignment_id)
  VALUES (del_id('Bsn1'), del_id('Bs'), del_id('B'), 'completed', NOW(), del_id('Apa'));
INSERT INTO exercise_logs(id, session_log_id, exercise_id, set_number, reps_completed, weight_kg, session_exercise_id)
  VALUES (del_id('Bsn2'), del_id('Bl'), del_id('Bex'), 2, 5, 40, del_id('Ase'));
INSERT INTO messages(id, conversation_id, sender_id, content, related_session_log_id)
  VALUES (del_id('Bsn3'), del_id('Bcv'), del_id('C'), 'ref', del_id('Al'));
INSERT INTO coach_notes(id, coach_id, athlete_id, session_log_id, content)
  VALUES (del_id('Bsn4'), del_id('C'), del_id('B'), del_id('Al'), 'ref');

-- A's row ids per table, saved BEFORE the deletion (checked by id afterwards).
CREATE TABLE del_rows(tbl TEXT, id UUID);
INSERT INTO del_rows
  SELECT 'exercises', id FROM exercises WHERE created_by = del_id('A')
  UNION ALL SELECT 'programs', id FROM programs WHERE created_by = del_id('A')
  UNION ALL SELECT 'sessions', id FROM sessions WHERE id = del_id('As')
  UNION ALL SELECT 'session_exercises', id FROM session_exercises WHERE id = del_id('Ase')
  UNION ALL SELECT 'program_assignments', id FROM program_assignments WHERE athlete_id = del_id('A')
  UNION ALL SELECT 'session_logs', id FROM session_logs WHERE athlete_id = del_id('A')
  UNION ALL SELECT 'exercise_logs', id FROM exercise_logs WHERE session_log_id = del_id('Al')
  UNION ALL SELECT 'readiness_logs', id FROM readiness_logs WHERE athlete_id = del_id('A')
  UNION ALL SELECT 'session_images', id FROM session_images WHERE athlete_id = del_id('A')
  UNION ALL SELECT 'coach_athletes', id FROM coach_athletes WHERE athlete_id = del_id('A')
  UNION ALL SELECT 'coach_notes', id FROM coach_notes WHERE athlete_id = del_id('A')
  UNION ALL SELECT 'conversations', id FROM conversations WHERE athlete_id = del_id('A')
  UNION ALL SELECT 'messages', id FROM messages WHERE conversation_id = del_id('Acv')
  UNION ALL SELECT 'profiles', id FROM profiles WHERE id = del_id('A');
CREATE TABLE del_lib AS
  SELECT (SELECT count(*) FROM programs WHERE is_public AND is_template) AS p,
         (SELECT count(*) FROM exercises WHERE is_public) AS e;
CREATE TEMP TABLE del_before AS
  SELECT del_snapshot('A') AS a, del_snapshot('B') AS b;
GRANT SELECT ON del_before TO PUBLIC;

-- ── D1  both seeded users hold data in many tables (the test is not vacuous) ─
DO $$
DECLARE na INT; nb INT;
BEGIN
  SELECT count(*) FILTER (WHERE value::bigint > 0) INTO na FROM del_before, jsonb_each_text(a);
  SELECT count(*) FILTER (WHERE value::bigint > 0) INTO nb FROM del_before, jsonb_each_text(b);
  PERFORM rec('DEL D1 fixtures put data for A and B in 15+ places each', na >= 15 AND na = nb,
              format('A=%s B=%s', na, nb));
END $$;

-- ── D1b  positive control by path: A has saved ids in all 14 tables, and the
--         four SET NULL references from B's rows are really set before the test
DO $$
DECLARE tables INT; refs INT;
BEGIN
  SELECT count(DISTINCT tbl) INTO tables FROM del_rows;
  SELECT (SELECT count(*) FROM session_logs WHERE id = del_id('Bsn1') AND program_assignment_id IS NOT NULL)
       + (SELECT count(*) FROM exercise_logs WHERE id = del_id('Bsn2') AND session_exercise_id IS NOT NULL)
       + (SELECT count(*) FROM messages WHERE id = del_id('Bsn3') AND related_session_log_id IS NOT NULL)
       + (SELECT count(*) FROM coach_notes WHERE id = del_id('Bsn4') AND session_log_id IS NOT NULL) INTO refs;
  PERFORM rec('DEL D1b before: A has rows by id in 14 tables, B has 4 rows pointing at A',
              tables = 14 AND refs = 4, format('tables=%s refs=%s', tables, refs));
END $$;

-- ── D2  signature: no argument, so a caller cannot name another account ─────
DO $$
DECLARE p RECORD;
BEGIN
  SELECT * INTO p FROM pg_proc WHERE proname = 'delete_my_account' AND pronamespace = 'public'::regnamespace;
  PERFORM rec('DEL D2 delete_my_account() takes no argument and returns void',
              FOUND AND p.pronargs = 0 AND p.prorettype = 'void'::regtype,
              CASE WHEN FOUND THEN 'args=' || p.pronargs ELSE 'function missing' END);
END $$;

-- ── D3  SECURITY DEFINER with a pinned search_path ─────────────────────────
DO $$
DECLARE p RECORD;
BEGIN
  SELECT * INTO p FROM pg_proc WHERE proname = 'delete_my_account' AND pronamespace = 'public'::regnamespace;
  PERFORM rec('DEL D3 security definer with search_path pinned to empty',
              FOUND AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""'],
              COALESCE(p.proconfig::text, 'no config'));
END $$;

-- ── D4  privileges: authenticated yes; anon and PUBLIC no ──────────────────
DO $$
DECLARE ok BOOLEAN;
BEGIN
  ok := has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE');
  PERFORM rec('DEL D4 EXECUTE granted to authenticated only (not anon)', ok);
EXCEPTION WHEN others THEN
  PERFORM rec('DEL D4 EXECUTE granted to authenticated only (not anon)', FALSE, SQLERRM);
END $$;

-- ── D5  anon cannot call it, and nothing is deleted ───────────────────────
DO $$
DECLARE r TEXT; users_after INT;
BEGIN
  r := del_call('anon', NULL);
  SELECT count(*) INTO users_after FROM auth.users WHERE id IN (del_id('A'), del_id('B'));
  PERFORM rec('DEL D5 anon cannot call the function', r LIKE '42501 permission denied%' AND users_after = 2,
              r || ' / users left=' || users_after);
END $$;

-- ── D6  a signed-in role with no identity is refused, nothing deleted ──────
DO $$
DECLARE r TEXT; users_after INT;
BEGIN
  r := del_call('authenticated', NULL);
  SELECT count(*) INTO users_after FROM auth.users WHERE id IN (del_id('A'), del_id('B'));
  PERFORM rec('DEL D6 no identity: refused with "not authenticated"',
              r LIKE '42501 not authenticated%' AND users_after = 2, r || ' / users left=' || users_after);
END $$;

-- ── D7  A deletes own account ──────────────────────────────────────────────
DO $$
DECLARE r TEXT;
BEGIN
  r := del_call('authenticated', del_id('A')::text);
  PERFORM rec('DEL D7 A can call the function', r = 'ok', r);
END $$;

-- ── D8  0 rows left for A in every table ──────────────────────────────────
DO $$
DECLARE left_over TEXT := del_nonzero(del_snapshot('A'));
BEGIN
  PERFORM rec('DEL D8 after deletion A has 0 rows in every table', left_over IS NULL,
              'left: ' || COALESCE(left_over, 'none'));
END $$;

-- ── D8b  the saved ids of A are gone from each table (checked by id)
DO $$
DECLARE r RECORD; n BIGINT; bad TEXT := '';
BEGIN
  FOR r IN SELECT DISTINCT tbl FROM del_rows LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN (SELECT id FROM del_rows WHERE tbl = %L)', r.tbl, r.tbl) INTO n;
    IF n > 0 THEN bad := bad || r.tbl || '=' || n || ' '; END IF;
  END LOOP;
  PERFORM rec('DEL D8b after deletion none of A''s saved ids remains in any table', bad = '', 'left: ' || bad);
END $$;

-- ── D8c  the 4 rows of B that pointed at A survive with the reference set to NULL
DO $$
DECLARE kept INT;
BEGIN
  SELECT (SELECT count(*) FROM session_logs WHERE id = del_id('Bsn1') AND program_assignment_id IS NULL)
       + (SELECT count(*) FROM exercise_logs WHERE id = del_id('Bsn2') AND session_exercise_id IS NULL)
       + (SELECT count(*) FROM messages WHERE id = del_id('Bsn3') AND related_session_log_id IS NULL)
       + (SELECT count(*) FROM coach_notes WHERE id = del_id('Bsn4') AND session_log_id IS NULL) INTO kept;
  PERFORM rec('DEL D8c B''s rows referencing A survive with the reference cleared (4 SET NULL keys)',
              kept = 4, 'kept=' || kept);
END $$;

-- ── D9  B keeps every row, exactly as before ──────────────────────────────
DO $$
DECLARE after_b JSONB := del_snapshot('B'); before_b JSONB;
BEGIN
  SELECT b INTO before_b FROM del_before;
  PERFORM rec('DEL D9 B keeps all rows after A is deleted', after_b = before_b,
              CASE WHEN after_b = before_b THEN 'identical' ELSE after_b::text END);
END $$;

-- ── D10  the coach and the public library are untouched
DO $$
DECLARE c INT; p BIGINT; e BIGINT; lp BIGINT; le BIGINT;
BEGIN
  SELECT count(*) INTO c FROM profiles WHERE id = del_id('C');
  SELECT count(*) FILTER (WHERE true) INTO p FROM programs WHERE is_public AND is_template;
  SELECT count(*) INTO e FROM exercises WHERE is_public;
  SELECT del_lib.p, del_lib.e INTO lp, le FROM del_lib;
  PERFORM rec('DEL D10 the coach and the public library (programs, exercises) are untouched',
              c = 1 AND p = lp AND e = le AND lp >= 1 AND le >= 1,
              format('coach=%s programs=%s/%s exercises=%s/%s', c, p, lp, e, le));
END $$;
-- ── D11  an unrelated account D deletes itself: B (and C) still untouched ─
DO $$
DECLARE r TEXT; same BOOLEAN; before_b JSONB;
BEGIN
  SELECT b INTO before_b FROM del_before;
  r := del_call('authenticated', del_id('D')::text);
  same := del_snapshot('B') = before_b;
  PERFORM rec('DEL D11 D''s call removes only D, B is unchanged',
              r = 'ok' AND same AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = del_id('D')),
              r || ' / B identical=' || same);
END $$;

-- ── D12  calling again after the account is gone does not fail ────────────
DO $$
DECLARE r TEXT;
BEGIN
  r := del_call('authenticated', del_id('D')::text);
  PERFORM rec('DEL D12 a second call for an already-deleted account is harmless', r = 'ok', r);
END $$;

-- ── W1  waitlist uses the CURRENT confirmed Auth address, not the stale profile one
DO $$
DECLARE r TEXT; cur INT; stale INT; third INT;
BEGIN
  r := del_call('authenticated', del_id('E')::text);
  SELECT count(*) INTO cur   FROM waitlist_subscribers WHERE email = 'del-e-new@test.local';
  SELECT count(*) INTO stale FROM waitlist_subscribers WHERE email = 'del-e@test.local';
  SELECT count(*) INTO third FROM waitlist_subscribers WHERE email = 'del-third@test.local';
  PERFORM rec('DEL W1 Auth address removed from the waitlist; stale profile address and a third party kept',
              r = 'ok' AND cur = 0 AND stale = 1 AND third = 1, format('%s current=%s stale=%s third=%s', r, cur, stale, third));
END $$;

-- ── W2  an unconfirmed address is never touched, the account is still deleted
DO $$
DECLARE r TEXT; w INT; u INT;
BEGIN
  r := del_call('authenticated', del_id('F')::text);
  SELECT count(*) INTO w FROM waitlist_subscribers WHERE email = 'del-f@test.local';
  SELECT count(*) INTO u FROM auth.users WHERE id = del_id('F');
  PERFORM rec('DEL W2 unconfirmed address: waitlist row kept, account deleted', r = 'ok' AND w = 1 AND u = 0,
              format('%s waitlist=%s user=%s', r, w, u));
END $$;

-- ── KL  KNOWN LIMIT (decision for Ralph, epic 12): documents today's behaviour.
--        Deleting a coach also deletes the athlete's logs made on the coach's program.
DO $$
DECLARE before_n INT; r TEXT; after_n INT; h INT;
BEGIN
  SELECT count(*) INTO before_n FROM session_logs WHERE id = del_id('Hl');
  r := del_call('authenticated', del_id('G')::text);
  SELECT count(*) INTO after_n FROM session_logs WHERE id = del_id('Hl');
  SELECT count(*) INTO h FROM profiles WHERE id = del_id('H');
  PERFORM rec('DEL KNOWN LIMIT deleting coach G also deletes athlete H''s logs on G''s program (H stays)',
              before_n = 1 AND r = 'ok' AND after_n = 0 AND h = 1,
              format('before=%s %s after=%s athlete profile=%s', before_n, r, after_n, h));
END $$;