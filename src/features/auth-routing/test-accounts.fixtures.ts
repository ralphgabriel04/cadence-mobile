import type { Session } from "@supabase/supabase-js";

import type { AuthState, Profile } from "@/providers/auth-state";

/**
 * The three test accounts of story 2.4: athlete, coach, and an account with a
 * session but no profiles row. Addresses use the reserved `.test` TLD; nothing
 * here is real data and nothing here is a credential.
 */
export const ATHLETE_ACCOUNT = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  email: "athlete@cadence.test",
  role: "athlete",
} as const;

export const COACH_ACCOUNT = {
  id: "cccccccc-0000-4000-8000-000000000002",
  email: "coach@cadence.test",
  role: "coach",
} as const;

export const NO_PROFILE_ACCOUNT = {
  id: "dddddddd-0000-4000-8000-000000000003",
  email: "noprofile@cadence.test",
} as const;

export function sessionFor(account: { id: string; email: string }): Session {
  return {
    access_token: "test-access",
    refresh_token: "test-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: account.id,
      email: account.email,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  } as Session;
}

export function profileFor(account: {
  id: string;
  email: string;
  role: "athlete" | "coach";
}): Profile {
  return {
    id: account.id,
    email: account.email,
    first_name: account.role === "coach" ? "Camille" : "Alex",
    last_name: "Test",
    role: account.role,
    avatar_url: null,
    onboarding_completed: false,
  };
}

export const athleteReady = (): AuthState => ({
  status: "ready",
  session: sessionFor(ATHLETE_ACCOUNT),
  profile: profileFor(ATHLETE_ACCOUNT),
});

export const coachReady = (): AuthState => ({
  status: "ready",
  session: sessionFor(COACH_ACCOUNT),
  profile: profileFor(COACH_ACCOUNT),
});

export const noProfile = (): AuthState => ({
  status: "profile-missing",
  session: sessionFor(NO_PROFILE_ACCOUNT),
});

export const slowProfile = (): AuthState => ({
  status: "loading-profile",
  session: sessionFor(ATHLETE_ACCOUNT),
});
