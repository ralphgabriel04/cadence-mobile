-- ============================================================================
-- 009 -- delete_my_account(): real account deletion, database side (cm#154 a)
-- ============================================================================
-- Called by the app as  supabase.rpc('delete_my_account')  with the signed-in
-- user's session. No argument: it can only ever act on auth.uid(), so a caller
-- cannot name another account.
--
-- What it removes:
--   * the waitlist row(s) with the account's CURRENT e-mail from auth.users, only if
--     that address is confirmed (personal data, no FK). The profile e-mail is a
--     mirror that can be stale, so it is not used.
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
--   * KNOWN LIMIT (product decision for Ralph, epic 12): deleting a COACH also deletes,
--     by cascade, other accounts' logs made on that coach's programs/exercises.
--     Pinned by test 'DEL KNOWN LIMIT'. Not changed here on purpose.
--   * A JWT already issued stays valid until it expires; the user no longer
--     exists (token refresh is expected to fail; not verified here).
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
  v_confirmed timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT email, email_confirmed_at INTO v_email, v_confirmed FROM auth.users WHERE id = v_uid;
  IF v_email IS NOT NULL AND v_confirmed IS NOT NULL THEN
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