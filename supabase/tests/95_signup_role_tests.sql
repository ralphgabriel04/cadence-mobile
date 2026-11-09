-- ============================================================================
-- Story 2.1: the role chosen at sign-up is the role stored in profiles.
-- Depends on rec() from 90_rls_tests.sql. A missing profile makes a test FAIL (COALESCE), never NULL;
-- the NULL guard in run.sh itself is fixed in PR #190 (track B), not here.
-- ============================================================================

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('51515151-5151-5151-5151-515151515151', 'coach-signup@test.local',
   '{"first_name":"Camille","last_name":"Coach","role":"coach"}'),
  ('52525252-5252-5252-5252-525252525252', 'athlete-signup@test.local',
   '{"first_name":"Alex","last_name":"Athlete","role":"athlete"}');

DO $$
DECLARE r TEXT;
BEGIN
  SELECT role::text INTO r FROM profiles WHERE id = '51515151-5151-5151-5151-515151515151';
  PERFORM rec('T95a sign-up with role=coach stores role=coach', COALESCE(r = 'coach', FALSE), 'role=' || COALESCE(r, 'ABSENT'));
  SELECT role::text INTO r FROM profiles WHERE id = '52525252-5252-5252-5252-525252525252';
  PERFORM rec('T95b sign-up with role=athlete stores role=athlete', COALESCE(r = 'athlete', FALSE), 'role=' || COALESCE(r, 'ABSENT'));
END $$;

-- The role is frozen afterwards (migration 004): changing it later must fail.
DO $$
DECLARE r TEXT;
BEGIN
  BEGIN
    UPDATE profiles SET role = 'athlete' WHERE id = '51515151-5151-5151-5151-515151515151';
  EXCEPTION WHEN OTHERS THEN
    NULL; -- blocked by the trigger: expected
  END;
  SELECT role::text INTO r FROM profiles WHERE id = '51515151-5151-5151-5151-515151515151';
  PERFORM rec('T95c a stored role cannot be changed afterwards', COALESCE(r = 'coach', FALSE), 'role=' || COALESCE(r, 'ABSENT'));
END $$;
