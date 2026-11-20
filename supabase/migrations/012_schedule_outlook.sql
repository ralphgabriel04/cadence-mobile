-- ============================================================================
-- 012 — get_schedule_outlook(): what comes after today (stories 4.2 and 4.3)
-- ============================================================================
--
-- get_today_screen() (007) answers "what is today". The home screen also needs:
--
--   * story 4.2 — on a rest day, the date of the NEXT planned session, even when
--     it falls next week (007 only looks at the rest of the current week), and a
--     way to tell "programme terminé" apart from "repos";
--   * story 4.3 — touching a day of the week strip shows the session planned
--     that day, so the client needs the session of each day of the week.
--
-- Kept as a separate function rather than a rewrite of get_today_screen():
-- the client calls both in parallel (one round trip of latency), and 007 stays
-- untouched, with its tests.
--
-- SECURITY INVOKER (the default): every read is subject to RLS, and the
-- assignment is filtered on athlete_id = auth.uid() so a coach never sees an
-- athlete's schedule here.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_schedule_outlook(p_on_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_athlete    UUID := auth.uid();
  v_assignment RECORD;
  v_dow        INTEGER := EXTRACT(ISODOW FROM p_on_date);
  v_monday     DATE := p_on_date - (EXTRACT(ISODOW FROM p_on_date)::int - 1);
  v_last_day   DATE;
  v_next       JSONB;
  v_week       JSONB;
  d            DATE;
  v_session    RECORD;
  v_capped     BOOLEAN;
BEGIN
  IF v_athlete IS NULL THEN
    RETURN NULL;
  END IF;

  -- Same assignment rule as get_today_screen(): the one in force on p_on_date.
  SELECT pa.id, pa.program_id, pa.start_date, pa.end_date, p.duration_weeks
    INTO v_assignment
    FROM program_assignments pa
    JOIN programs p ON p.id = pa.program_id
   WHERE pa.athlete_id = v_athlete
     AND pa.status = 'active'
     AND NOT pa.is_deleted
     AND NOT p.is_deleted
     AND (pa.start_date IS NULL OR pa.start_date <= p_on_date)
     AND (pa.end_date IS NULL OR pa.end_date >= p_on_date)
   ORDER BY pa.start_date DESC NULLS LAST, pa.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    -- No program in force. If the athlete's last program ended before today
    -- (end date passed, or marked completed), say « Programme terminé » rather
    -- than « Aucun programme en cours » (story 4.2, criterion 4).
    RETURN jsonb_build_object(
      'nextSession', NULL,
      'programFinished', EXISTS (
        SELECT 1
          FROM program_assignments pa
          JOIN programs p ON p.id = pa.program_id
         WHERE pa.athlete_id = v_athlete
           AND NOT pa.is_deleted
           AND NOT p.is_deleted
           AND (pa.status = 'completed'
                OR (pa.status = 'active' AND pa.end_date < p_on_date))
           AND NOT EXISTS (  -- a program starting later is not "finished"
             SELECT 1 FROM program_assignments f
              WHERE f.athlete_id = v_athlete AND NOT f.is_deleted
                AND f.status = 'active' AND f.start_date > p_on_date)),
      'weekSessions', '[]'::jsonb);
  END IF;

  -- Last day the program can still plan something: the assignment's end date,
  -- the end of its last week, or 8 weeks ahead -- whichever comes first. The
  -- 8-week cap bounds the search for a program that repeats forever.
  v_last_day := LEAST(
    COALESCE(v_assignment.end_date, p_on_date + 56),
    CASE WHEN v_assignment.duration_weeks IS NOT NULL AND v_assignment.start_date IS NOT NULL
         THEN v_assignment.start_date + v_assignment.duration_weeks * 7 - 1
         ELSE p_on_date + 56 END,
    p_on_date + 56
  );
  -- When the 8-week cap is what stopped the search, an empty result says
  -- nothing about the program's end: it is not « terminé ».
  v_capped := v_last_day >= p_on_date + 56;

  -- ── Story 4.2: the next planned session after today ──────────────────────
  d := p_on_date + 1;
  WHILE d <= v_last_day AND v_next IS NULL LOOP
    SELECT s.id, s.name
      INTO v_session
      FROM sessions s
     WHERE s.program_id = v_assignment.program_id
       AND NOT s.is_deleted
       AND s.day_of_week = EXTRACT(ISODOW FROM d)::int
       AND (s.week_number IS NULL
            OR s.week_number = program_week_number(COALESCE(v_assignment.start_date, d), d))
     ORDER BY (s.week_number IS NULL), s.order_index
     LIMIT 1;
    IF FOUND THEN
      v_next := jsonb_build_object('sessionId', v_session.id, 'name', v_session.name,
                                   'date', d, 'dayOfWeek', EXTRACT(ISODOW FROM d)::int);
    END IF;
    d := d + 1;
  END LOOP;

  -- ── Story 4.3: the session planned on each day of the current week ───────
  SELECT COALESCE(jsonb_agg(x.item ORDER BY x.dow), '[]'::jsonb)
    INTO v_week
    FROM (
      SELECT dow,
             jsonb_build_object(
               'dayOfWeek', dow,
               'date', v_monday + (dow - 1),
               'sessionId', s.id,
               'name', s.name,
               'estimatedDurationMinutes', s.estimated_duration_minutes,
               'exerciseCount', (SELECT count(*) FROM session_exercises se
                                  WHERE se.session_id = s.id AND NOT se.is_deleted)
             ) AS item
        FROM generate_series(1, 7) AS dow
        CROSS JOIN LATERAL (
          SELECT s2.id, s2.name, s2.estimated_duration_minutes
            FROM sessions s2
           WHERE s2.program_id = v_assignment.program_id
             AND NOT s2.is_deleted
             AND s2.day_of_week = dow
             AND (s2.week_number IS NULL
                  OR s2.week_number = program_week_number(
                       COALESCE(v_assignment.start_date, v_monday + (dow - 1)),
                       v_monday + (dow - 1)))
           ORDER BY (s2.week_number IS NULL), s2.order_index
           LIMIT 1
        ) s
    ) x;

  RETURN jsonb_build_object(
    'nextSession', v_next,
    -- Nothing left to plan after today, within the program's bounds.
    'programFinished', v_next IS NULL AND NOT v_capped,
    'weekSessions', v_week
  );
END;
$$;

COMMENT ON FUNCTION get_schedule_outlook(DATE) IS
  'Next planned session after p_on_date (searched up to 8 weeks, bounded by the assignment and the program length), whether the program has nothing left, and the session of each day of the current week. SECURITY INVOKER; p_on_date is the athlete''s local date.';

REVOKE EXECUTE ON FUNCTION get_schedule_outlook(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_schedule_outlook(DATE) TO authenticated;
