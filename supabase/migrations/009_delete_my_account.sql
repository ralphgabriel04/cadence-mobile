-- ============================================================================
-- 009 -- delete_my_account(): real account deletion, database side (cm#154 a)
-- ============================================================================
-- Called by the app as  supabase.rpc('delete_my_account')  with the signed-in
-- user's session. No argument: it can only ever act on auth.uid(), so a caller
-- cannot name another account.
--
-- What it removes:
--   * the waitlist row(s) with the account's e-mail (personal data, no FK)
--   * the profile, which cascades (ON DELETE CASCADE) to programs and exercises
--     the user created, sessions, session_exercises, assignments, session_logs,
--     exercise_logs (sets), readiness_logs, session_images, coach_athletes,
--     coach_notes, conversations and messages
--   * the auth.users row, which ends every session and makes sign-in impossible
--
-- SECURITY DEFINER because a user has no DELETE right on auth.users. Safe
-- because: no parameter, identity read only from auth.uid(), search_path
-- emptied (every name is schema-qualified), EXECUTE revoked from PUBLIC and
-- anon. It is a real deletion, not the soft-delete flag.
--
-- Known limits (see the story journal):
--   * Files in Storage (avatars, session photos) are not removed by SQL; the
--     follow-up is an Edge Function using the service role key held server-side.
--   * Backups age out on their normal cycle (ticket default).
--   * A coach's deletion also removes athlete history attached to the coach's
--     own programs (cascade); the coach space is epic 12 and is out of scope.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;
  IF v_email IS NOT NULL THEN
    DELETE FROM public.waitlist_subscribers WHERE lower(email) = lower(v_email);
  END IF;

  -- Explicit, so the data goes even if a foreign key is ever changed.
  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

COMMENT ON FUNCTION public.delete_my_account() IS
  'Deletes the calling user''s data and auth account for real. No argument: acts only on auth.uid(). Callable by authenticated only. Storage files are removed separately.';