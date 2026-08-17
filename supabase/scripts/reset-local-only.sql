-- ============================================================================
-- Cadence — DESTRUCTIVE SCHEMA RESET — LOCAL DEVELOPMENT ONLY
-- ============================================================================
--
-- This script DROPS every application table, trigger, function and enum type.
-- All data in them is permanently lost. There is no undo.
--
-- It lives in supabase/scripts/ and NOT in supabase/migrations/ on purpose.
-- Anything inside migrations/ is executed by `supabase db reset` and by any
-- sequential migration run. A destructive reset placed there would wipe real
-- data the moment someone ran a routine migration command -- including
-- waitlist_subscribers, which holds the landing page waiting list in
-- production. Keep this file out of migrations/.
--
-- Read supabase/scripts/README.md before running this.
--
-- Usage (local only):
--   SET cadence.allow_destructive_reset = 'yes';
--   \i supabase/scripts/reset-local-only.sql
--
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Guard 1 — explicit opt-in.
-- Running the file without setting the flag aborts before anything is dropped.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF current_setting('cadence.allow_destructive_reset', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION
      'Destructive reset refused: run "SET cadence.allow_destructive_reset = ''yes'';" first. Local development databases only -- never a project holding real data.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Guard 2 — production canary.
-- waitlist_subscribers is populated by the public landing page, so any row in
-- it means this is not a throwaway local database. Catches the case where the
-- opt-in above was pasted into the wrong session.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  n BIGINT;
BEGIN
  IF to_regclass('public.waitlist_subscribers') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.waitlist_subscribers' INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION
        'Destructive reset refused: waitlist_subscribers holds % row(s). This database contains real data. Aborting.', n;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Drop tables (reverse dependency order)
-- ============================================================================

DROP TABLE IF EXISTS waitlist_subscribers CASCADE;
DROP TABLE IF EXISTS coach_notes CASCADE;
DROP TABLE IF EXISTS session_images CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS readiness_logs CASCADE;
DROP TABLE IF EXISTS exercise_logs CASCADE;
DROP TABLE IF EXISTS session_logs CASCADE;
DROP TABLE IF EXISTS program_assignments CASCADE;
DROP TABLE IF EXISTS session_exercises CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS exercises CASCADE;
DROP TABLE IF EXISTS coach_athletes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================================
-- Drop triggers and functions
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at();

-- ============================================================================
-- Drop enum types
-- ============================================================================

DROP TYPE IF EXISTS message_type;
DROP TYPE IF EXISTS difficulty_level;
DROP TYPE IF EXISTS exercise_category;
DROP TYPE IF EXISTS session_log_status;
DROP TYPE IF EXISTS assignment_status;
DROP TYPE IF EXISTS program_status;
DROP TYPE IF EXISTS relationship_status;
DROP TYPE IF EXISTS user_role;

SELECT 'Schema reset complete. Now run supabase/migrations/001_initial_schema.sql' AS status;
