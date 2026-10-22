import type { Session } from "@supabase/supabase-js";

import type { Tables } from "@/types/database";

/**
 * The subset of the profiles row the app needs everywhere. Derived from the
 * generated database types, so a schema change that drops or renames one of
 * these columns fails type-check instead of failing at runtime.
 */
export type Profile = Pick<
  Tables<"profiles">,
  "id" | "email" | "first_name" | "last_name" | "role" | "avatar_url" | "onboarding_completed"
>;

/** Columns fetchProfile must select. Kept next to Profile so the two cannot drift. */
export const PROFILE_COLUMNS =
  "id, email, first_name, last_name, role, avatar_url, onboarding_completed" as const;

/**
 * Authentication state as a discriminated union rather than a bag of nullable
 * fields.
 *
 * The distinction that matters for routing is between states where the answer
 * is not known yet (`initializing`, `loading-profile`) and states where it is
 * (everything else). The previous implementation collapsed both into a single
 * `loading` boolean that was cleared before the profile arrived, which left a
 * window where `session` was set and `profile` was still null. Routing read
 * that window as "signed in, not a coach" and sent every coach to the athlete
 * UI before bouncing them -- the screen flash and the navigation loop.
 */
export type AuthState =
  /** No answer from the auth client yet. Nothing may be decided. */
  | { status: "initializing" }
  /** Definitively no session. */
  | { status: "signed-out" }
  /** Session known, profile request in flight. Still nothing to decide. */
  | { status: "loading-profile"; session: Session }
  /** Terminal success. */
  | { status: "ready"; session: Session; profile: Profile }
  /**
   * Authenticated, but no profiles row. Reachable when the handle_new_user
   * trigger failed, or when the row was soft-deleted. Not an error to retry --
   * the account needs attention -- so it gets its own state.
   */
  | { status: "profile-missing"; session: Session }
  /** The profile request failed. Retryable. */
  | { status: "error"; session: Session; message: string };

export type AuthEvent =
  | { type: "session-resolved"; session: Session | null }
  | { type: "signed-out" }
  | { type: "profile-loaded"; profile: Profile }
  | { type: "profile-missing" }
  | { type: "profile-failed"; message: string }
  | { type: "profile-reload" };

export const initialAuthState: AuthState = { status: "initializing" };

/**
 * Pure reducer. Kept free of React and of the Supabase client so the state
 * machine can be tested without rendering anything or mocking the network.
 */
export function authReducer(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case "session-resolved": {
      if (!event.session) return { status: "signed-out" };
      // A token refresh re-emits the session for a user whose profile is
      // already loaded. Re-entering `loading-profile` there would blank the UI
      // on every refresh, so an unchanged user keeps its resolved state.
      if (
        (state.status === "ready" ||
          state.status === "profile-missing" ||
          state.status === "error") &&
        state.session.user.id === event.session.user.id
      ) {
        return { ...state, session: event.session };
      }
      return { status: "loading-profile", session: event.session };
    }

    case "signed-out":
      return { status: "signed-out" };

    case "profile-loaded": {
      // Ignore a response that arrived after sign-out or after a user switch:
      // without this an in-flight request for the previous user could install
      // their profile over the new session.
      if (!("session" in state)) return state;
      if (state.session.user.id !== event.profile.id) return state;
      return { status: "ready", session: state.session, profile: event.profile };
    }

    case "profile-missing":
      if (!("session" in state)) return state;
      return { status: "profile-missing", session: state.session };

    case "profile-failed":
      if (!("session" in state)) return state;
      return { status: "error", session: state.session, message: event.message };

    case "profile-reload":
      if (!("session" in state)) return state;
      return { status: "loading-profile", session: state.session };
  }
}

// ── Derivations ──────────────────────────────────────────────────────────────

/** States in which the identity of the user is not yet known. */
export type ResolvingAuthState = Extract<
  AuthState,
  { status: "initializing" | "loading-profile" }
>;

/** States in which it is. */
export type ResolvedAuthState = Exclude<AuthState, ResolvingAuthState>;

/**
 * True while the answer is still unknown. Routing must render a splash rather
 * than redirect while this holds -- that is the whole fix for the flash.
 *
 * Declared as a type predicate, not as a plain boolean, so that an early
 * `if (isResolving(state)) return <Splash />` actually narrows `state` for the
 * rest of the function. That turns "never read the role before it is known"
 * from a convention into something the compiler enforces: reaching
 * `state.profile` without handling the resolving states is a type error.
 */
export function isResolving(state: AuthState): state is ResolvingAuthState {
  return state.status === "initializing" || state.status === "loading-profile";
}

export function sessionOf(state: AuthState): Session | null {
  return "session" in state ? state.session : null;
}

export function profileOf(state: AuthState): Profile | null {
  return state.status === "ready" ? state.profile : null;
}

/**
 * Where an authenticated user belongs. Single source of truth: every layout
 * calls this instead of re-deriving the rule, which is how the previous
 * implementation ended up with `(auth)` gating on `session && profile` while
 * its siblings gated on `session` alone.
 *
 * The 2026 product is athlete-only (ADR-003 at product level). A coach account
 * is routed to an explicit notice, never to an empty coach dashboard.
 */
export type HomeRoute = "/(athlete)" | "/(coach)" | "/(auth)/login";

export function homeRouteFor(state: AuthState): HomeRoute | null {
  if (isResolving(state)) return null;
  if (state.status === "signed-out") return "/(auth)/login";
  if (state.status === "ready") {
    return state.profile.role === "coach" ? "/(coach)" : "/(athlete)";
  }
  // profile-missing and error: the user is authenticated but unroutable by
  // role. Send them to the athlete group, whose layout renders the matching
  // recovery UI. Returning "/(auth)/login" here would sign-out-loop a user who
  // holds a perfectly valid session.
  return "/(athlete)";
}
