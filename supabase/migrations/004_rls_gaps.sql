-- ============================================================================
-- 004 — RLS and privacy gaps in the canonical schema
-- ============================================================================
--
-- The five fixes below come from an audit of 001_initial_schema.sql performed
-- 2026-08-17. Each one names the concrete attack or leak it closes.
--
-- Fixes that DROP and recreate an existing policy do so because PostgreSQL
-- combines permissive policies with OR: adding a stricter policy alongside a
-- loose one does not restrict anything. Tightening requires replacement.
--
-- No policy added here references a table that references it back; the
-- acyclicity invariant documented in 003 still holds.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FIX 1 — profiles was readable in full by every authenticated user
-- ----------------------------------------------------------------------------
-- Before:
--     CREATE POLICY "Authenticated users can read profiles"
--       ON profiles FOR SELECT TO authenticated USING (NOT is_deleted);
--
-- Any signed-in account could read every row of profiles: email, phone,
-- first_name, last_name, bio. That is a bulk personal-data disclosure and an
-- account-enumeration primitive. Under Loi 25 it is also a disclosure we have
-- no basis for -- an athlete has no reason to read another athlete's email.
--
-- After: a profile is readable by its owner, and by the counterparty of an
-- active coach-athlete relationship.

DROP POLICY "Authenticated users can read profiles" ON profiles;

CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id AND NOT is_deleted);

CREATE POLICY "Coach and athlete can read each other's profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.status = 'active'
        AND NOT ca.is_deleted
        AND (
          (ca.coach_id = auth.uid() AND ca.athlete_id = profiles.id) OR
          (ca.athlete_id = auth.uid() AND ca.coach_id = profiles.id)
        )
    )
  );

-- ----------------------------------------------------------------------------
-- FIX 2 — role, email and identity columns were self-mutable
-- ----------------------------------------------------------------------------
-- "Users can update own profile" allows UPDATE on any column of one's own row,
-- role included. A user could therefore promote themselves to 'coach'.
--
-- Severity, stated honestly: in this schema `role` is NOT an authorization
-- input. No RLS policy reads profiles.role -- coach-side policies all key on
-- `auth.uid() = coach_id` or on an active coach_athletes row. Self-promotion
-- therefore yields a coach UI with no reachable data, not privilege escalation.
-- It is still wrong: it strands data (a role flip orphans the athlete's logs
-- from the athlete UI), it desynchronises profiles.role from auth metadata, and
-- it leaves a column that looks authoritative freely writable by its subject.
--
-- RLS cannot express column-level restrictions, so this is a trigger.

CREATE OR REPLACE FUNCTION prevent_profile_identity_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profiles.role cannot be changed after creation (attempted % -> %)', OLD.role, NEW.role
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'profiles.email is mirrored from auth.users and cannot be changed directly'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profiles.id cannot be changed'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Deliberately NOT SECURITY DEFINER: this function only inspects the rows the
-- trigger already hands it and needs no elevated rights.

COMMENT ON FUNCTION prevent_profile_identity_change() IS
  'Blocks changes to profiles.role, profiles.email and profiles.id. Role is set once at signup by handle_new_user(); changing it later strands the account''s data in the wrong UI. Email is mirrored from auth.users -- change it there.';

CREATE TRIGGER profiles_prevent_identity_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profile_identity_change();

-- ----------------------------------------------------------------------------
-- FIX 3 — handle_new_user() had a mutable search_path and an unsafe enum cast
-- ----------------------------------------------------------------------------
-- Two defects in the original:
--
--   a) SECURITY DEFINER with no `SET search_path`. A SECURITY DEFINER function
--      resolves unqualified names using the CALLER's search_path, so a role
--      able to create a schema earlier in that path can shadow a referenced
--      object and have it executed with the function owner's rights. This is
--      the `function_search_path_mutable` finding in Supabase's own linter.
--
--   b) `COALESCE((raw_user_meta_data->>'role')::user_role, 'athlete')` casts
--      before it defaults. An empty string or any non-enum value raises
--      invalid_input_value inside the auth.users trigger, which aborts the
--      signup with an opaque 500 rather than creating an athlete.
--
-- Note on the role source: raw_user_meta_data is client-controlled, so a client
-- can request role='coach' at signup. Per the project rule "never use
-- user_metadata as authorization" this would be disqualifying if role were an
-- authorization input -- it is not (see FIX 2). The value is kept as a declared
-- account type, validated against the enum, and frozen by FIX 2 afterwards.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT := NEW.raw_user_meta_data->>'role';
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    CASE
      WHEN requested_role IN ('coach', 'athlete') THEN requested_role::user_role
      ELSE 'athlete'::user_role
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION handle_new_user() IS
  'Creates the public.profiles row for a new auth.users row. SECURITY DEFINER is required: the trigger runs in the auth context, which has no rights on public.profiles. search_path is pinned so unqualified names cannot be shadowed by a caller-controlled schema.';

-- ----------------------------------------------------------------------------
-- FIX 4 — session_logs could be created against any session in the database
-- ----------------------------------------------------------------------------
-- Before:
--     WITH CHECK (auth.uid() = athlete_id)
--
-- The only condition was that the athlete owned the log. session_id was
-- unconstrained, so an athlete could INSERT a session_log referencing any
-- sessions.id -- including a session of another athlete's private program or a
-- coach programme they were never assigned. Because exercise_logs' own
-- WITH CHECK only verifies that the parent session_log belongs to the caller,
-- that forged log then became a legitimate parent for arbitrary exercise_logs
-- rows, letting an athlete write history against exercises they were never
-- prescribed and skewing every aggregate built on top.
--
-- After: the referenced session must be one the athlete can actually read.
-- Visibility is the authorisation rule, as in 003.
--
-- Chain: session_logs.INSERT -> sessions.SELECT -> {programs, program_assignments}
--        .SELECT -> program_assignments.SELECT -> nothing. Terminates.

DROP POLICY "Athletes can manage their session logs" ON session_logs;

CREATE POLICY "Athletes can read their session logs"
  ON session_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id AND NOT is_deleted);

CREATE POLICY "Athletes can log sessions they can read"
  ON session_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = athlete_id
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_logs.session_id
        AND NOT s.is_deleted
    )
  );

CREATE POLICY "Athletes can update their session logs"
  ON session_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = athlete_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Athletes can delete their session logs"
  ON session_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = athlete_id);

-- ----------------------------------------------------------------------------
-- FIX 5 — waitlist_subscribers exists in production but in no migration
-- ----------------------------------------------------------------------------
-- The table backs the landing page waiting list and its public counter. It was
-- created out of band, so any database rebuilt from migrations/ lacks a table
-- production has. This brings it under version control additively -- 001 is
-- NOT edited, per ADR-004.
--
-- IF NOT EXISTS throughout: on production the table is already there and this
-- migration must be a no-op for it rather than an error.

CREATE TABLE IF NOT EXISTS waitlist_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'landing_page',
  referral_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  confirmed BOOLEAN DEFAULT FALSE
);

ALTER TABLE waitlist_subscribers ENABLE ROW LEVEL SECURITY;

-- Signup comes from the public landing page and from the app before login, so
-- INSERT must be reachable by anon. The bound on length is a cheap guard
-- against junk; uniqueness is already enforced by UNIQUE(email).
DROP POLICY IF EXISTS "Public can join waitlist with valid email" ON waitlist_subscribers;
CREATE POLICY "Public can join waitlist with valid email"
  ON waitlist_subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(trim(email)) BETWEEN 5 AND 320
    AND position('@' IN email) > 1
  );

-- No SELECT policy for anon or authenticated, deliberately. The subscriber list
-- is personal data: reading it is service_role only (admin jobs, exports).
-- The public counter must be served by an aggregate, never by selecting rows;
-- see get_waitlist_count() in 006.
DROP POLICY IF EXISTS "Service role can select subscribers" ON waitlist_subscribers;
CREATE POLICY "Service role can read subscribers"
  ON waitlist_subscribers FOR SELECT
  TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_waitlist_subscribers_email
  ON waitlist_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_subscribers_created_at
  ON waitlist_subscribers(created_at);

COMMENT ON TABLE waitlist_subscribers IS
  'Landing page waiting list. Personal data: no SELECT for anon or authenticated. Reachable for INSERT by anon so the public page can work; counted through get_waitlist_count().';
