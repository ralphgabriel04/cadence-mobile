import type { Session } from "@supabase/supabase-js";

import {
  authReducer,
  homeRouteFor,
  initialAuthState,
  isResolving,
  profileOf,
  sessionOf,
  type AuthState,
  type Profile,
} from "../auth-state";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeSession(userId: string): Session {
  // Only `user.id` is read by the reducer; the rest is shape-filling.
  return {
    access_token: "token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  } as Session;
}

function makeProfile(id: string, role: "coach" | "athlete" = "athlete"): Profile {
  return {
    id,
    email: "a@test.local",
    first_name: "Alice",
    last_name: "A",
    role,
    avatar_url: null,
    onboarding_completed: false,
  };
}

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

/** Applies a sequence of events, for readability in the tests below. */
function reduceAll(state: AuthState, ...events: Parameters<typeof authReducer>[1][]): AuthState {
  return events.reduce(authReducer, state);
}

// ── The happy paths ──────────────────────────────────────────────────────────

describe("authReducer — resolution", () => {
  it("starts in a state where nothing may be decided", () => {
    expect(initialAuthState.status).toBe("initializing");
    expect(isResolving(initialAuthState)).toBe(true);
    expect(homeRouteFor(initialAuthState)).toBeNull();
  });

  it("resolves to signed-out when there is no session", () => {
    const s = authReducer(initialAuthState, { type: "session-resolved", session: null });
    expect(s.status).toBe("signed-out");
    expect(isResolving(s)).toBe(false);
    expect(homeRouteFor(s)).toBe("/(auth)/login");
  });

  it("goes through loading-profile before ready", () => {
    const loading = authReducer(initialAuthState, {
      type: "session-resolved",
      session: makeSession(ALICE),
    });
    expect(loading.status).toBe("loading-profile");
    // The whole point of the state: a session without a profile is NOT routable.
    expect(isResolving(loading)).toBe(true);
    expect(homeRouteFor(loading)).toBeNull();

    const ready = authReducer(loading, {
      type: "profile-loaded",
      profile: makeProfile(ALICE),
    });
    expect(ready.status).toBe("ready");
    expect(isResolving(ready)).toBe(false);
    expect(profileOf(ready)?.id).toBe(ALICE);
  });
});

// ── The bug this state machine exists to prevent ──────────────────────────────

describe("authReducer — no routable state with an unknown role", () => {
  it("never yields a home route while the profile is in flight", () => {
    const loading = authReducer(initialAuthState, {
      type: "session-resolved",
      session: makeSession(ALICE),
    });
    // Previously `loading` was cleared here, routing read profile === null as
    // "not a coach", and every coach was sent to the athlete UI before bouncing.
    expect(homeRouteFor(loading)).toBeNull();
  });

  it("routes a coach to the coach group only once the profile is known", () => {
    const ready = reduceAll(
      initialAuthState,
      { type: "session-resolved", session: makeSession(ALICE) },
      { type: "profile-loaded", profile: makeProfile(ALICE, "coach") },
    );
    expect(homeRouteFor(ready)).toBe("/(coach)");
  });

  it("routes an athlete to the athlete group", () => {
    const ready = reduceAll(
      initialAuthState,
      { type: "session-resolved", session: makeSession(ALICE) },
      { type: "profile-loaded", profile: makeProfile(ALICE, "athlete") },
    );
    expect(homeRouteFor(ready)).toBe("/(athlete)");
  });
});

// ── Token refresh must not blank the UI ──────────────────────────────────────

describe("authReducer — token refresh", () => {
  it("keeps a resolved profile when the same user's session is re-emitted", () => {
    const ready = reduceAll(
      initialAuthState,
      { type: "session-resolved", session: makeSession(ALICE) },
      { type: "profile-loaded", profile: makeProfile(ALICE) },
    );

    const refreshed = authReducer(ready, {
      type: "session-resolved",
      session: makeSession(ALICE),
    });

    expect(refreshed.status).toBe("ready");
    expect(isResolving(refreshed)).toBe(false);
    expect(homeRouteFor(refreshed)).toBe("/(athlete)");
  });

  it("re-enters loading-profile when the user actually changes", () => {
    const ready = reduceAll(
      initialAuthState,
      { type: "session-resolved", session: makeSession(ALICE) },
      { type: "profile-loaded", profile: makeProfile(ALICE) },
    );

    const switched = authReducer(ready, {
      type: "session-resolved",
      session: makeSession(BOB),
    });

    expect(switched.status).toBe("loading-profile");
    expect(sessionOf(switched)?.user.id).toBe(BOB);
  });
});

// ── Late and stale responses ──────────────────────────────────────────────────

describe("authReducer — stale responses", () => {
  it("drops a profile that belongs to a different user", () => {
    const loadingBob = reduceAll(
      initialAuthState,
      { type: "session-resolved", session: makeSession(ALICE) },
      { type: "profile-loaded", profile: makeProfile(ALICE) },
      { type: "session-resolved", session: makeSession(BOB) },
    );
    expect(loadingBob.status).toBe("loading-profile");

    // Alice's in-flight request lands after Bob signed in.
    const after = authReducer(loadingBob, {
      type: "profile-loaded",
      profile: makeProfile(ALICE),
    });

    expect(after.status).toBe("loading-profile");
    expect(profileOf(after)).toBeNull();
  });

  it("ignores a profile that arrives after sign-out", () => {
    const signedOut = reduceAll(
      initialAuthState,
      { type: "session-resolved", session: makeSession(ALICE) },
      { type: "signed-out" },
    );

    const after = authReducer(signedOut, {
      type: "profile-loaded",
      profile: makeProfile(ALICE),
    });

    expect(after.status).toBe("signed-out");
  });

  it("ignores profile failures that arrive after sign-out", () => {
    const signedOut = authReducer(initialAuthState, { type: "signed-out" });
    expect(authReducer(signedOut, { type: "profile-failed", message: "offline" }).status).toBe(
      "signed-out",
    );
    expect(authReducer(signedOut, { type: "profile-missing" }).status).toBe("signed-out");
    expect(authReducer(signedOut, { type: "profile-reload" }).status).toBe("signed-out");
  });
});

// ── Failure modes are distinct, and none of them loops ───────────────────────

describe("authReducer — failure modes", () => {
  it("distinguishes a missing profile from a failed request", () => {
    const loading = authReducer(initialAuthState, {
      type: "session-resolved",
      session: makeSession(ALICE),
    });

    const missing = authReducer(loading, { type: "profile-missing" });
    const failed = authReducer(loading, { type: "profile-failed", message: "network down" });

    expect(missing.status).toBe("profile-missing");
    expect(failed.status).toBe("error");
    if (failed.status === "error") {
      expect(failed.message).toBe("network down");
    }
  });

  it("does not send an authenticated user back to login on failure", () => {
    // Routing an authenticated user to /(auth)/login would loop: the auth layout
    // sees a session and bounces them straight back out.
    const failed = reduceAll(
      initialAuthState,
      { type: "session-resolved", session: makeSession(ALICE) },
      { type: "profile-failed", message: "network down" },
    );
    expect(homeRouteFor(failed)).toBe("/(athlete)");

    const missing = reduceAll(
      initialAuthState,
      { type: "session-resolved", session: makeSession(ALICE) },
      { type: "profile-missing" },
    );
    expect(homeRouteFor(missing)).toBe("/(athlete)");
  });

  it("retries from an error without losing the session", () => {
    const failed = reduceAll(
      initialAuthState,
      { type: "session-resolved", session: makeSession(ALICE) },
      { type: "profile-failed", message: "network down" },
    );

    const retrying = authReducer(failed, { type: "profile-reload" });
    expect(retrying.status).toBe("loading-profile");
    expect(sessionOf(retrying)?.user.id).toBe(ALICE);

    const ready = authReducer(retrying, {
      type: "profile-loaded",
      profile: makeProfile(ALICE),
    });
    expect(ready.status).toBe("ready");
  });

  it("keeps the failure state across a token refresh instead of silently retrying", () => {
    const failed = reduceAll(
      initialAuthState,
      { type: "session-resolved", session: makeSession(ALICE) },
      { type: "profile-failed", message: "network down" },
    );
    const refreshed = authReducer(failed, {
      type: "session-resolved",
      session: makeSession(ALICE),
    });
    expect(refreshed.status).toBe("error");
  });
});

// ── Every reachable state resolves to exactly one routing outcome ────────────

describe("homeRouteFor — totality", () => {
  const session = makeSession(ALICE);
  const states: AuthState[] = [
    { status: "initializing" },
    { status: "signed-out" },
    { status: "loading-profile", session },
    { status: "ready", session, profile: makeProfile(ALICE, "athlete") },
    { status: "ready", session, profile: makeProfile(ALICE, "coach") },
    { status: "profile-missing", session },
    { status: "error", session, message: "boom" },
  ];

  it.each(states)("resolves $status without throwing", (state) => {
    const route = homeRouteFor(state);
    if (isResolving(state)) {
      expect(route).toBeNull();
    } else {
      expect(route).not.toBeNull();
    }
  });

  it("only ever returns login for a state with no session", () => {
    for (const state of states) {
      if (homeRouteFor(state) === "/(auth)/login") {
        expect(sessionOf(state)).toBeNull();
      }
    }
  });
});
