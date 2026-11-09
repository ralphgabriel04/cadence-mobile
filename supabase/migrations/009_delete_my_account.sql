-- ============================================================================
-- 009 -- delete_my_account(): real account deletion, database side (cm#154 a)
-- ============================================================================
-- Called as supabase.rpc('delete_my_account') with the user's session. No
-- argument: it acts only on auth.uid(), so a caller cannot name another account.
-- Removes: the waitlist row of the account's CURRENT Auth e-mail (only if
-- confirmed; the profile e-mail can be stale and is not used); the profile, which
-- cascades to all the user's data; the auth.users row (ends sessions, blocks
-- sign-in). SECURITY DEFINER because a user cannot delete from auth.users; safe
-- because of no parameter, identity from auth.uid(), empty search_path, EXECUTE
-- revoked from PUBLIC and anon. Real deletion, not the is_deleted flag.
--
-- Known limits:
--   * Storage files (avatars, photos) are not removed by SQL; follow-up: Edge
--     Function with the service role key kept server-side.
--   * Backups age out on their normal cycle (ticket default).
--   * KNOWN LIMIT (decision for Ralph, epic 12): deleting a COACH also deletes, by
--     cascade, other accounts' logs made on that coach's programs/exercises.
--     Pinned by test 'DEL KNOWN LIMIT'. Not changed on purpose.
--   * A JWT already issued stays valid until it expires (refresh not verified).
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