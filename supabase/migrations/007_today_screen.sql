-- ============================================================================
-- 007 — get_today_screen(): the whole home screen in one round trip (cm#104)
-- ============================================================================
--
-- WHY ONE FUNCTION RATHER THAN SEVERAL QUERIES
--
-- The home screen needs five things: the athlete's name, today's session with
-- its prescription and the athlete's last performance on each exercise, the
-- current week's progress, and a summary of the last completed session.
--
-- Fetching those from the client costs three SEQUENTIAL round trips, because
-- each step needs the previous one's answer:
--
--   1. the active assignment          (start_date is needed for the week number)
--   2. the week's sessions            (needed to know today's exercises)
--   3. the last performance per exercise
--
-- Step 3 is also where the N+1 lives: one call per exercise is the obvious
-- implementation and the wrong one. Doing the whole thing here makes it a single
-- round trip and makes the N+1 impossible to write by accident -- the lateral
-- join below resolves every exercise's history in one pass, served by
-- idx_exercise_logs_exercise_set.
--
-- Connectivity is the product's stated constraint: an athlete logs sets in a gym
-- basement. Three sequential round trips before the screen can render is the
-- wrong trade there.
--
-- SECURITY
-- SECURITY INVOKER (the default). Every table read below is subject to its own
-- RLS policies, so this function cannot return anything the caller could not
-- read with a plain query. In particular session_logs and exercise_logs are
-- restricted to the caller's own rows, which is why the queries never mention
-- athlete_id for them -- RLS is the filter.
--
-- p_on_date is the athlete's LOCAL date and must be supplied by the client.
-- Defaulting to CURRENT_DATE would use the server's timezone and put an athlete
-- in Vancouver on tomorrow's session for part of every evening.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: the week strip when there is no program to derive it from
-- ----------------------------------------------------------------------------
-- Returned for the no-active-program state so the client always receives seven
-- days and never has to special-case a missing array.

CREATE OR REPLACE FUNCTION empty_week_days(p_on_date DATE)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'dayOfWeek', dow,
             'isToday', dow = EXTRACT(ISODOW FROM p_on_date)::int,
             'state', 'rest'
           ) ORDER BY dow
         ), '[]'::jsonb)
    FROM generate_series(1, 7) AS dow;
$$;

COMMENT ON FUNCTION empty_week_days(DATE) IS
  'Seven rest days, for the no-active-program state. Keeps the week strip shape constant so the client never branches on a missing array.';

CREATE OR REPLACE FUNCTION get_today_screen(p_on_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_athlete      UUID := auth.uid();
  v_first_name   TEXT;
  v_assignment   RECORD;
  v_week         INTEGER;
  v_dow          INTEGER := EXTRACT(ISODOW FROM p_on_date);
  v_session      RECORD;
  v_log          RECORD;
  v_today        JSONB;
  v_week_json    JSONB;
  v_last_session JSONB;
  v_exercises    JSONB;
  v_next         JSONB;
  v_has_assignment BOOLEAN;
BEGIN
  IF v_athlete IS NULL THEN
    -- The caller is not authenticated. Returning NULL rather than an empty
    -- payload lets the service tell "signed out" apart from "nothing planned".
    RETURN NULL;
  END IF;

  SELECT first_name INTO v_first_name FROM profiles WHERE id = v_athlete;

  -- ── The last completed session, independent of any assignment ────────────
  SELECT jsonb_build_object(
           'sessionLogId', sl.id,
           'name', s.name,
           'completedAt', sl.completed_at,
           'exerciseCount', (
             SELECT count(DISTINCT el.exercise_id)
               FROM exercise_logs el
              WHERE el.session_log_id = sl.id AND NOT el.is_deleted
           ),
           'durationMinutes', sl.duration_minutes,
           'prCount', (
             SELECT count(*)
               FROM exercise_logs el
              WHERE el.session_log_id = sl.id AND el.is_pr AND NOT el.is_deleted
           )
         )
    INTO v_last_session
    FROM session_logs sl
    JOIN sessions s ON s.id = sl.session_id
   WHERE sl.status = 'completed'
     AND sl.completed_at IS NOT NULL
     AND NOT sl.is_deleted
   ORDER BY sl.completed_at DESC
   LIMIT 1;

  -- ── The active assignment ────────────────────────────────────────────────
  -- Bounded to assignments actually in force on p_on_date. An assignment that
  -- starts next month is 'active' but must not drive today's screen.
  SELECT pa.id, pa.program_id, pa.start_date, p.name AS program_name, p.coach_id
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

  v_has_assignment := FOUND;

  -- ── No assignment in force: nothing to plan ──────────────────────────────
  IF NOT v_has_assignment THEN
    RETURN jsonb_build_object(
      'athleteFirstName', COALESCE(v_first_name, ''),
      'date', p_on_date,
      'today', jsonb_build_object('state', 'no-active-program'),
      'week', jsonb_build_object(
        'weekNumber', NULL,
        'days', empty_week_days(p_on_date),
        'completedCount', 0,
        'scheduledCount', 0
      ),
      'lastSession', v_last_session
    );
  END IF;

  v_week := program_week_number(v_assignment.start_date, p_on_date);

  -- ── Today's session ──────────────────────────────────────────────────────
  -- A session whose week_number is NULL repeats every week, so it matches any
  -- week. An exact week match wins over a repeating one, hence the ORDER BY.
  SELECT s.id, s.name, s.description, s.day_of_week, s.week_number,
         s.estimated_duration_minutes
    INTO v_session
    FROM sessions s
   WHERE s.program_id = v_assignment.program_id
     AND NOT s.is_deleted
     AND s.day_of_week = v_dow
     AND (s.week_number = v_week OR s.week_number IS NULL)
   ORDER BY (s.week_number IS NULL), s.order_index
   LIMIT 1;

  -- ── The week strip ───────────────────────────────────────────────────────
  SELECT jsonb_build_object(
           'weekNumber', v_week,
           'days', COALESCE(jsonb_agg(d.day ORDER BY d.dow), '[]'::jsonb),
           'completedCount', count(*) FILTER (WHERE d.day->>'state' = 'completed'),
           'scheduledCount', count(*) FILTER (WHERE d.day->>'state' <> 'rest')
         )
    INTO v_week_json
    FROM (
      SELECT dow,
             jsonb_build_object(
               'dayOfWeek', dow,
               'isToday', dow = v_dow,
               'state', COALESCE(
                 (
                   SELECT CASE
                            WHEN sl.status = 'completed' THEN 'completed'
                            WHEN sl.status = 'skipped' THEN 'skipped'
                            ELSE 'started'
                          END
                     FROM sessions s2
                     JOIN session_logs sl ON sl.session_id = s2.id
                    WHERE s2.program_id = v_assignment.program_id
                      AND NOT s2.is_deleted
                      AND s2.day_of_week = dow
                      AND (s2.week_number = v_week OR s2.week_number IS NULL)
                      AND NOT sl.is_deleted
                      -- Confine the log to the calendar week p_on_date sits in,
                      -- so a repeating session's log from three weeks ago does
                      -- not mark this week's day as done.
                      AND COALESCE(sl.completed_at, sl.started_at)::date
                          BETWEEN (p_on_date - (v_dow - 1)) AND (p_on_date + (7 - v_dow))
                    ORDER BY COALESCE(sl.completed_at, sl.started_at) DESC
                    LIMIT 1
                 ),
                 CASE
                   WHEN EXISTS (
                     SELECT 1 FROM sessions s3
                      WHERE s3.program_id = v_assignment.program_id
                        AND NOT s3.is_deleted
                        AND s3.day_of_week = dow
                        AND (s3.week_number = v_week OR s3.week_number IS NULL)
                   ) THEN 'upcoming'
                   ELSE 'rest'
                 END
               )
             ) AS day
        FROM generate_series(1, 7) AS dow
    ) d;

  -- ── No session today: a rest day ─────────────────────────────────────────
  IF v_session.id IS NULL THEN
    SELECT jsonb_build_object('sessionId', s.id, 'name', s.name, 'dayOfWeek', s.day_of_week)
      INTO v_next
      FROM sessions s
     WHERE s.program_id = v_assignment.program_id
       AND NOT s.is_deleted
       AND s.day_of_week > v_dow
       AND (s.week_number = v_week OR s.week_number IS NULL)
     ORDER BY s.day_of_week, s.order_index
     LIMIT 1;

    RETURN jsonb_build_object(
      'athleteFirstName', COALESCE(v_first_name, ''),
      'date', p_on_date,
      'today', jsonb_build_object(
        'state', 'rest-day',
        'programName', v_assignment.program_name,
        'nextSession', v_next
      ),
      'week', v_week_json,
      'lastSession', v_last_session
    );
  END IF;

  -- ── The prescription, with each exercise's last performance ──────────────
  -- One pass. The LATERAL resolves the most recent completed session containing
  -- the exercise, then its sets -- no per-exercise round trip, and no per-exercise
  -- subquery repeated by the client.
  SELECT COALESCE(jsonb_agg(x.item ORDER BY x.order_index), '[]'::jsonb)
    INTO v_exercises
    FROM (
      SELECT se.order_index,
             jsonb_build_object(
               'sessionExerciseId', se.id,
               'exerciseId', e.id,
               'name', e.name,
               'category', e.category,
               'equipment', e.equipment,
               'muscleGroups', COALESCE(to_jsonb(e.muscle_groups), '[]'::jsonb),
               'videoUrl', e.video_url,
               'instructions', e.instructions,
               'orderIndex', se.order_index,
               'sets', se.sets,
               'reps', se.reps,
               'weightSuggestion', se.weight_suggestion,
               'restSeconds', se.rest_seconds,
               'tempo', se.tempo,
               'notes', se.notes,
               'supersetGroup', se.superset_group,
               'lastPerformance', last_perf.payload
             ) AS item
        FROM session_exercises se
        JOIN exercises e ON e.id = se.exercise_id
        LEFT JOIN LATERAL (
          SELECT jsonb_build_object(
                   'performedAt', prev.completed_at,
                   'sets', (
                     SELECT COALESCE(jsonb_agg(
                              jsonb_build_object(
                                'setNumber', el2.set_number,
                                'repsCompleted', el2.reps_completed,
                                'weightKg', el2.weight_kg,
                                'rpe', el2.rpe,
                                'durationSeconds', el2.duration_seconds,
                                'distanceMeters', el2.distance_meters,
                                'isPr', COALESCE(el2.is_pr, FALSE)
                              ) ORDER BY el2.set_number
                            ), '[]'::jsonb)
                       FROM exercise_logs el2
                      WHERE el2.session_log_id = prev.id
                        AND el2.exercise_id = se.exercise_id
                        AND NOT el2.is_deleted
                   )
                 ) AS payload
            FROM (
              SELECT sl.id, sl.completed_at
                FROM exercise_logs el
                JOIN session_logs sl ON sl.id = el.session_log_id
               WHERE el.exercise_id = se.exercise_id
                 AND sl.completed_at IS NOT NULL
                 AND NOT el.is_deleted
                 AND NOT sl.is_deleted
               ORDER BY sl.completed_at DESC
               LIMIT 1
            ) prev
        ) last_perf ON TRUE
       WHERE se.session_id = v_session.id
         AND NOT se.is_deleted
    ) x;

  -- ── The state of today's session ─────────────────────────────────────────
  -- Only logs belonging to p_on_date, or an in-progress one from any date: a
  -- session started last night and never finished is still the one to resume.
  SELECT sl.id, sl.started_at, sl.completed_at, sl.duration_minutes,
         sl.overall_rpe, sl.notes, sl.status, sl.paused_at, sl.total_paused_seconds,
         (SELECT count(*) FROM exercise_logs el
           WHERE el.session_log_id = sl.id AND NOT el.is_deleted) AS logged_set_count
    INTO v_log
    FROM session_logs sl
   WHERE sl.session_id = v_session.id
     AND NOT sl.is_deleted
     AND (sl.status = 'in_progress'
          OR COALESCE(sl.completed_at, sl.started_at)::date = p_on_date)
   ORDER BY (sl.status = 'in_progress') DESC,
            COALESCE(sl.completed_at, sl.started_at) DESC
   LIMIT 1;

  v_today := jsonb_build_object(
    'session', jsonb_build_object(
      'sessionId', v_session.id,
      'name', v_session.name,
      'description', v_session.description,
      'estimatedDurationMinutes', v_session.estimated_duration_minutes,
      'weekNumber', v_session.week_number,
      'dayOfWeek', v_session.day_of_week,
      'exercises', v_exercises,
      'programName', v_assignment.program_name,
      'coachFirstName', (
        SELECT p.first_name FROM profiles p WHERE p.id = v_assignment.coach_id
      )
    )
  );

  IF v_log.id IS NULL THEN
    v_today := v_today || jsonb_build_object('state', 'scheduled');
  ELSIF v_log.status = 'in_progress' THEN
    v_today := v_today || jsonb_build_object(
      'state', 'in-progress',
      'log', jsonb_build_object(
        'sessionLogId', v_log.id,
        'startedAt', v_log.started_at,
        'status', v_log.status,
        'loggedSetCount', v_log.logged_set_count,
        'pausedAt', v_log.paused_at,
        'totalPausedSeconds', v_log.total_paused_seconds
      )
    );
  ELSIF v_log.status = 'completed' THEN
    v_today := v_today || jsonb_build_object(
      'state', 'completed',
      'log', jsonb_build_object(
        'sessionLogId', v_log.id,
        'startedAt', v_log.started_at,
        'status', v_log.status,
        'loggedSetCount', v_log.logged_set_count,
        'completedAt', v_log.completed_at,
        'durationMinutes', v_log.duration_minutes,
        'overallRpe', v_log.overall_rpe,
        'notes', v_log.notes
      )
    );
  ELSE
    v_today := v_today || jsonb_build_object(
      'state', 'skipped',
      'log', jsonb_build_object(
        'sessionLogId', v_log.id,
        'startedAt', v_log.started_at,
        'status', v_log.status,
        'loggedSetCount', v_log.logged_set_count
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'athleteFirstName', COALESCE(v_first_name, ''),
    'date', p_on_date,
    'today', v_today,
    'week', v_week_json,
    'lastSession', v_last_session
  );
END;
$$;

COMMENT ON FUNCTION get_today_screen(DATE) IS
  'Whole home-screen payload for the calling athlete in one round trip. SECURITY INVOKER, so RLS restricts every read to the caller. p_on_date must be the athlete''s LOCAL date -- defaulting to the server''s CURRENT_DATE would show the wrong day for part of every evening outside the server timezone.';
