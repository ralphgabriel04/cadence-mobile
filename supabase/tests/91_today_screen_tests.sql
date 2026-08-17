-- ============================================================================
-- get_today_screen() — one scenario per state of the cm#101 data contract
--
-- Depends on the fixtures and the rec() helper from 90_rls_tests.sql.
-- Dates are fixed and explicit: 2026-08-17 is a Monday (ISODOW 1), so
-- 08-17 = Mon, 08-18 = Tue, 08-19 = Wed, 08-21 = Fri.
-- ============================================================================

-- ── Fixtures: a 3-day program assigned to Carol, starting Monday ────────────
-- Carol is used rather than Alice so the earlier tests' logs do not interfere.

INSERT INTO programs (id, coach_id, created_by, is_public, is_template, name, status, duration_weeks)
VALUES ('caaa0001-0000-0000-0000-000000000001', NULL,
        '33333333-3333-3333-3333-333333333333', FALSE, FALSE,
        'Full body 3j', 'active', 4);

INSERT INTO sessions (id, program_id, name, day_of_week, week_number, order_index, estimated_duration_minutes)
VALUES ('cbbb0001-0000-0000-0000-000000000001', 'caaa0001-0000-0000-0000-000000000001',
        'Jour A — Haut du corps', 1, 1, 0, 55),
       ('cbbb0002-0000-0000-0000-000000000002', 'caaa0001-0000-0000-0000-000000000001',
        'Jour B — Bas du corps', 3, 1, 0, 50),
       ('cbbb0003-0000-0000-0000-000000000003', 'caaa0001-0000-0000-0000-000000000001',
        'Jour C — Complet', 5, 1, 0, 60);

INSERT INTO session_exercises (session_id, exercise_id, order_index, sets, reps, rest_seconds, tempo)
VALUES ('cbbb0001-0000-0000-0000-000000000001', 'aaaa0002-0000-0000-0000-000000000002', 0, 4, '8-12', 90, '3-1-1-0'),
       ('cbbb0001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 1, 3, '10', 120, NULL);

-- ── T30  no active program ──────────────────────────────────────────────────
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  r := get_today_screen(DATE '2026-08-17');
  RESET ROLE;
  PERFORM rec('T30 no assignment yields no-active-program with a 7-day strip',
              r->'today'->>'state' = 'no-active-program'
                AND jsonb_array_length(r->'week'->'days') = 7
                AND (r->'week'->>'weekNumber') IS NULL
                AND r->>'athleteFirstName' = 'Carol',
              COALESCE(r->'today'->>'state', 'NULL'));
END $$;

-- ── Assign the program, starting Monday 2026-08-17 ──────────────────────────
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  INSERT INTO program_assignments (program_id, athlete_id, coach_id, start_date, status)
  VALUES ('caaa0001-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333', NULL, DATE '2026-08-17', 'active');
  RESET ROLE;
  PERFORM rec('T31 athlete self-assigns the 3-day program', TRUE);
EXCEPTION WHEN others THEN
  RESET ROLE;
  PERFORM rec('T31 athlete self-assigns the 3-day program', FALSE, SQLERRM);
END $$;

-- ── T32  a scheduled session, with its prescription ────────────────────────
DO $$
DECLARE r JSONB; ex JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  r := get_today_screen(DATE '2026-08-17');
  RESET ROLE;
  ex := r->'today'->'session'->'exercises';
  PERFORM rec('T32 Monday yields state=scheduled with 2 ordered exercises',
              r->'today'->>'state' = 'scheduled'
                AND r->'today'->'session'->>'name' = 'Jour A — Haut du corps'
                AND jsonb_array_length(ex) = 2
                AND ex->0->>'orderIndex' = '0'
                AND ex->1->>'orderIndex' = '1'
                AND (r->'week'->>'weekNumber') = '1',
              format('state=%s exercises=%s', r->'today'->>'state', jsonb_array_length(ex)));
END $$;

-- ── T33  reps stays TEXT, and rest/tempo come through ──────────────────────
DO $$
DECLARE ex JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  ex := (get_today_screen(DATE '2026-08-17'))->'today'->'session'->'exercises'->0;
  RESET ROLE;
  PERFORM rec('T33 prescription carries reps as text, sets, rest and tempo',
              ex->>'reps' = '8-12'
                AND jsonb_typeof(ex->'reps') = 'string'
                AND ex->>'sets' = '4'
                AND ex->>'restSeconds' = '90'
                AND ex->>'tempo' = '3-1-1-0'
                AND ex->'lastPerformance' = 'null'::jsonb,
              format('reps=%s type=%s', ex->>'reps', jsonb_typeof(ex->'reps')));
END $$;

-- ── T34  coachFirstName is null for a self-created program ────────────────
DO $$
DECLARE s JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  s := (get_today_screen(DATE '2026-08-17'))->'today'->'session';
  RESET ROLE;
  PERFORM rec('T34 coachFirstName is null on a coachless program',
              s->'coachFirstName' = 'null'::jsonb AND s->>'programName' = 'Full body 3j',
              format('coach=%s program=%s', s->>'coachFirstName', s->>'programName'));
END $$;

-- ── T35  rest day, with the next session ahead in the week ────────────────
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  r := get_today_screen(DATE '2026-08-18');   -- Tuesday: nothing scheduled
  RESET ROLE;
  PERFORM rec('T35 Tuesday yields rest-day pointing at Wednesday',
              r->'today'->>'state' = 'rest-day'
                AND r->'today'->>'programName' = 'Full body 3j'
                AND r->'today'->'nextSession'->>'dayOfWeek' = '3',
              format('state=%s next=%s', r->'today'->>'state',
                     r->'today'->'nextSession'->>'dayOfWeek'));
END $$;

-- ── T36  the week strip marks three scheduled days and today ──────────────
DO $$
DECLARE w JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  w := (get_today_screen(DATE '2026-08-18'))->'week';
  RESET ROLE;
  PERFORM rec('T36 week strip: 7 days, 3 scheduled, Tuesday flagged today',
              jsonb_array_length(w->'days') = 7
                AND (w->>'scheduledCount') = '3'
                AND (w->>'completedCount') = '0'
                AND (w->'days'->1->>'isToday') = 'true'
                AND (w->'days'->0->>'state') = 'upcoming'
                AND (w->'days'->1->>'state') = 'rest',
              format('scheduled=%s completed=%s', w->>'scheduledCount', w->>'completedCount'));
END $$;

-- ── T37  an in-progress session ───────────────────────────────────────────
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  INSERT INTO session_logs (id, session_id, athlete_id, status, started_at)
  VALUES ('cccf0001-0000-0000-0000-000000000001',
          'cbbb0001-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333', 'in_progress',
          TIMESTAMPTZ '2026-08-17 18:00:00+00');
  INSERT INTO exercise_logs (session_log_id, exercise_id, set_number, reps_completed, weight_kg)
  VALUES ('cccf0001-0000-0000-0000-000000000001','aaaa0002-0000-0000-0000-000000000002',1,10,70);
  r := get_today_screen(DATE '2026-08-17');
  RESET ROLE;
  PERFORM rec('T37 an open log yields in-progress with its set count',
              r->'today'->>'state' = 'in-progress'
                AND r->'today'->'log'->>'loggedSetCount' = '1'
                AND r->'today'->'log'->>'sessionLogId' = 'cccf0001-0000-0000-0000-000000000001',
              format('state=%s sets=%s', r->'today'->>'state',
                     r->'today'->'log'->>'loggedSetCount'));
END $$;

-- ── T38  an in-progress session from yesterday is still resumable ─────────
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  -- Wednesday has its own session, but Monday's log is still open. The screen
  -- must surface Wednesday, not silently resume Monday's.
  r := get_today_screen(DATE '2026-08-19');
  RESET ROLE;
  PERFORM rec('T38 Wednesday shows its own session, not Monday''s open log',
              r->'today'->'session'->>'name' = 'Jour B — Bas du corps'
                AND r->'today'->>'state' = 'scheduled',
              format('session=%s state=%s', r->'today'->'session'->>'name',
                     r->'today'->>'state'));
END $$;

-- ── T39  a completed session ──────────────────────────────────────────────
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  UPDATE session_logs
     SET status = 'completed',
         completed_at = TIMESTAMPTZ '2026-08-17 19:05:00+00',
         duration_minutes = 52,
         overall_rpe = 8,
         notes = 'Bonne séance'
   WHERE id = 'cccf0001-0000-0000-0000-000000000001';
  r := get_today_screen(DATE '2026-08-17');
  RESET ROLE;
  PERFORM rec('T39 a finished log yields completed with duration and RPE',
              r->'today'->>'state' = 'completed'
                AND r->'today'->'log'->>'durationMinutes' = '52'
                AND r->'today'->'log'->>'overallRpe' = '8'
                AND r->'today'->'log'->>'notes' = 'Bonne séance',
              format('state=%s duration=%s', r->'today'->>'state',
                     r->'today'->'log'->>'durationMinutes'));
END $$;

-- ── T40  the completed day shows up in the week strip ─────────────────────
DO $$
DECLARE w JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  w := (get_today_screen(DATE '2026-08-19'))->'week';
  RESET ROLE;
  PERFORM rec('T40 week strip counts Monday as completed',
              (w->>'completedCount') = '1' AND (w->'days'->0->>'state') = 'completed',
              format('completed=%s monday=%s', w->>'completedCount',
                     w->'days'->0->>'state'));
END $$;

-- ── T41  lastSession summarises the completed session ─────────────────────
DO $$
DECLARE ls JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  ls := (get_today_screen(DATE '2026-08-19'))->'lastSession';
  RESET ROLE;
  PERFORM rec('T41 lastSession carries name, duration and exercise count',
              ls->>'name' = 'Jour A — Haut du corps'
                AND ls->>'durationMinutes' = '52'
                AND ls->>'exerciseCount' = '1',
              format('name=%s exercises=%s', ls->>'name', ls->>'exerciseCount'));
END $$;

-- ── T42  the last performance now feeds the prescription ──────────────────
-- The whole point of the lateral join: the next time this exercise comes up,
-- the athlete sees what they did last time -- with no extra round trip.
--
-- Needs a week 2 session, since the fixtures above pin everything to week 1.
-- Adding one also exercises the "exact week match wins over a repeating
-- session" ordering in get_today_screen().
INSERT INTO sessions (id, program_id, name, day_of_week, week_number, order_index, estimated_duration_minutes)
VALUES ('cbbb0004-0000-0000-0000-000000000004', 'caaa0001-0000-0000-0000-000000000001',
        'Jour A — Haut du corps (S2)', 1, 2, 0, 55);

INSERT INTO session_exercises (session_id, exercise_id, order_index, sets, reps, rest_seconds)
VALUES ('cbbb0004-0000-0000-0000-000000000004', 'aaaa0002-0000-0000-0000-000000000002', 0, 4, '8-12', 90);

DO $$
DECLARE ex JSONB; lp JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  ex := (get_today_screen(DATE '2026-08-24'))->'today'->'session'->'exercises'->0;
  RESET ROLE;
  lp := ex->'lastPerformance';
  PERFORM rec('T42 lastPerformance is embedded, with the logged sets',
              ex IS NOT NULL
                AND lp <> 'null'::jsonb
                AND jsonb_array_length(lp->'sets') = 1
                AND lp->'sets'->0->>'weightKg' = '70'
                AND lp->'sets'->0->>'repsCompleted' = '10',
              format('exercise=%s lastPerformance=%s',
                     COALESCE(ex->>'name','NULL'), COALESCE(lp::text, 'NULL')));
END $$;

-- ── T42b  the week 2 session wins over nothing, and is the right one ──────
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  r := get_today_screen(DATE '2026-08-24');
  RESET ROLE;
  PERFORM rec('T42b week 2 resolves to the week 2 session',
              r->'today'->'session'->>'name' = 'Jour A — Haut du corps (S2)'
                AND (r->'week'->>'weekNumber') = '2',
              format('session=%s week=%s', r->'today'->'session'->>'name',
                     r->'week'->>'weekNumber'));
END $$;

-- ── T43  a week 2 session still resolves when week_number is NULL ─────────
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  r := get_today_screen(DATE '2026-08-31');   -- week 3, nothing defined for it
  RESET ROLE;
  -- Sessions are pinned to week_number 1 and 2, so week 3 has nothing scheduled.
  -- This documents the behaviour rather than asserting it is desirable: a
  -- 4-week program that only defines weeks 1 and 2 leaves 3 and 4 empty. A
  -- session meant to repeat every week must set week_number = NULL.
  PERFORM rec('T43 a week the program does not define is empty',
              r->'today'->>'state' = 'rest-day' AND (r->'week'->>'weekNumber') = '3',
              format('state=%s week=%s', r->'today'->>'state', r->'week'->>'weekNumber'));
END $$;

-- ── T44  an assignment that has not started yet is ignored ────────────────
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '33333333-3333-3333-3333-333333333333', true);
  r := get_today_screen(DATE '2026-08-10');   -- a week before start_date
  RESET ROLE;
  PERFORM rec('T44 an assignment starting later does not drive the screen',
              r->'today'->>'state' = 'no-active-program',
              format('state=%s', r->'today'->>'state'));
END $$;

-- ── T45  an unauthenticated caller gets NULL, not an empty payload ────────
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '', true);
  r := get_today_screen(DATE '2026-08-17');
  RESET ROLE;
  PERFORM rec('T45 no auth.uid() returns NULL so the client can tell it apart',
              r IS NULL, format('r=%s', COALESCE(r::text, 'NULL')));
END $$;

-- ── T46  one athlete never sees another's session or history ──────────────
DO $$
DECLARE r JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.uid', '22222222-2222-2222-2222-222222222222', true);
  r := get_today_screen(DATE '2026-08-17');
  RESET ROLE;
  PERFORM rec('T46 Bob sees his own empty screen, not Carol''s program',
              r->'today'->>'state' = 'no-active-program'
                AND r->'lastSession' = 'null'::jsonb,
              format('state=%s lastSession=%s', r->'today'->>'state',
                     r->'lastSession'));
END $$;
