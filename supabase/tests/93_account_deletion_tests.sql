-- ============================================================================
-- 93 -- Account deletion, database side (cm#154 part a, story 2.6)
-- ============================================================================
-- delete_my_account() must remove EVERYTHING that belongs to the caller (0 rows
-- left in every table), leave every other account untouched, take no argument
-- (so nobody can target someone else), and be closed to anon.
--
-- LIMIT: auth.uid() is a GUC stub and auth.users is a stub table (see
-- 00_harness.sql). This proves the SQL logic and the cascades, not that the
-- real Supabase `postgres` role may delete from auth.users, nor that GoTrue
-- then refuses sign-in. Those two points are checked on the local stack.
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

-- Row counts for user u. Direct ownership is discovered from the foreign keys
-- that point at profiles or auth.users, so a table added later is counted
-- automatically; the tables owned only through a parent are listed by id.
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

-- ── D9  B keeps every row, exactly as before ──────────────────────────────
DO $$
DECLARE after_b JSONB := del_snapshot('B'); before_b JSONB;
BEGIN
  SELECT b INTO before_b FROM del_before;
  PERFORM rec('DEL D9 B keeps all rows after A is deleted', after_b = before_b,
              CASE WHEN after_b = before_b THEN 'identical' ELSE after_b::text END);
END $$;

-- ── D10  the coach C and the shared public library are untouched ──────────
DO $$
DECLARE c INT;
BEGIN
  SELECT count(*) INTO c FROM profiles WHERE id = del_id('C');
  PERFORM rec('DEL D10 the coach linked to A is still there', c = 1, 'profiles=' || c);
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
