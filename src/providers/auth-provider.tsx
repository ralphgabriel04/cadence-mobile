import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { type Session, type User } from "@supabase/supabase-js";

import { supabase } from "@/config/supabase";

import { resetErrorMessage } from "./reset-errors";
import {
  armRecovery,
  clearRecoveryRequest,
  disarmRecovery,
  hasFreshRecoveryRequest,
  readRecoveryMarker,
  markRecoveryRequested,
} from "@/features/auth-routing/recovery-flag";
import {
  EXPIRED_LINK_MESSAGE,
  NOT_REQUESTED_MESSAGE,
  parseRecoveryLink,
} from "@/features/auth-routing/recovery-link";
import {
  authReducer,
  initialAuthState,
  isResolving,
  profileOf,
  sessionOf,
  PROFILE_COLUMNS,
  type AuthState,
  type Profile,
} from "./auth-state";

export type { AuthState, Profile } from "./auth-state";

type AuthContextType = {
  /**
   * The full state machine. New code should read this: it distinguishes
   * "profile still loading" from "no profile", which the flags below cannot.
   */
  state: AuthState;

  /**
   * Derived conveniences, kept so existing screens keep working unchanged.
   * `loading` now stays true until the profile is resolved -- previously it was
   * cleared first, which is what let routing act on an unknown role.
   */
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;

  refreshProfile: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: "coach" | "athlete";
  }) => Promise<{ error: string | null }>;
  /** Resolves false when an open recovery could not be ended (the session is still on the device). */
  signOut: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  /** Turns the recovery link opened from the email into a (temporary) recovery session. */
  acceptRecoveryLink: (url: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

/** PostgREST code for "expected exactly one row, got none". */
const PGRST_NO_ROWS = "PGRST116";
const LINK_OPEN_FAILED = "Impossible d'ouvrir le lien, réessaie";

/**
 * Ends the local session and checks it is really gone, whatever signOut says:
 * it can reject or return an error before erasing anything. Same logic as
 * signOutAndClearLocal (#194), kept minimal here because that branch is not in this stack.
 */
async function endLocalSession(): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // judged below on the stored session, not on this call
    }
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return true;
    } catch {
      // unknown counts as not cleared
    }
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  // Guards every dispatch after teardown, and lets a stale response be dropped.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A recovery session is open in this run (mirrors the persisted marker).
  const recoveryArmed = useRef(false);
  // Resolves once the startup check is done.
  const startup = useRef<Promise<void>>(Promise.resolve());
  // The link already turned into the current recovery session (a remount of the
  // reset screen must not replay it).
  const acceptedUrl = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (!mounted.current) return;

    if (error) {
      // maybeSingle() returns data: null rather than an error for "no rows",
      // but a PostgREST version or a RLS change can still surface the code.
      if (error.code === PGRST_NO_ROWS) {
        dispatch({ type: "profile-missing" });
        return;
      }
      dispatch({ type: "profile-failed", message: error.message });
      return;
    }

    if (!data) {
      dispatch({ type: "profile-missing" });
      return;
    }

    dispatch({ type: "profile-loaded", profile: data });
  }, []);

  // Resolve the session, then the profile. The two are sequenced deliberately:
  // routing may not act until both are known.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    startup.current = (async () => {
      // A recovery left open by a previous run must not resume as a login: end it first.
      const marker = await readRecoveryMarker();
      if (marker !== "clear") {
        // Armed, or unreadable (treated the same): the stored session is not trusted.
        if (await endLocalSession()) await disarmRecovery();
        else recoveryArmed.current = true; // still there: stay on the recovery screen
      }
      if (cancelled) return;

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted.current) return;
        if (event === "SIGNED_OUT" || !session) {
          recoveryArmed.current = false;
          void disarmRecovery();
          dispatch({ type: "signed-out" });
          return;
        }
        if (event === "PASSWORD_RECOVERY") {
          recoveryArmed.current = true;
          void armRecovery().then((ok) => ok || endLocalSession());
        }
        dispatch(
          recoveryArmed.current
            ? { type: "recovery-started", session }
            : { type: "session-resolved", session }
        );
      });
      unsubscribe = () => subscription.unsubscribe();

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (mounted.current) {
          dispatch(
            recoveryArmed.current && session
              ? { type: "recovery-started", session }
              : { type: "session-resolved", session }
          );
        }
      } catch (cause: unknown) {
        if (!mounted.current) return;
        // Without this the app hung on the splash forever when the auth client
        // failed -- the previous implementation had no rejection handler at all,
        // so `loading` was never cleared.
        dispatch({ type: "session-resolved", session: null });
        if (__DEV__) {
          console.warn("[auth] getSession failed", cause);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // One place that turns "a session needs a profile" into a request. Runs for
  // the initial session and for any user switch, and never for a token refresh
  // of an already-resolved user (the reducer keeps those out of this state).
  const pendingUserId = state.status === "loading-profile" ? state.session.user.id : null;
  useEffect(() => {
    if (!pendingUserId) return;
    void fetchProfile(pendingUserId);
  }, [pendingUserId, fetchProfile]);

  const refreshProfile = useCallback(() => {
    dispatch({ type: "profile-reload" });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes("rate limit")) {
        return { error: "Trop de tentatives. Veuillez réessayer dans quelques minutes." };
      }
      // Deliberately generic: a distinct "unknown account" message would let
      // anyone enumerate registered addresses (ADR-001).
      return { error: "Courriel ou mot de passe incorrect" };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(
    async (params: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: "coach" | "athlete";
    }) => {
      const { error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            first_name: params.firstName,
            last_name: params.lastName,
            role: params.role,
          },
        },
      });

      // The profiles row is created by the handle_new_user() trigger on
      // auth.users. The previous implementation also upserted it from the
      // client, which was redundant, raced the trigger, and -- since migration
      // 004 froze profiles.role -- would now fail outright if the two disagreed.
      if (error) {
        if (error.message.includes("already registered")) {
          return { error: "Ce courriel est déjà utilisé" };
        }
        if (error.message.includes("rate limit")) {
          return { error: "Trop de tentatives. Veuillez réessayer dans quelques minutes." };
        }
        return { error: error.message };
      }
      return { error: null };
    },
    []
  );

  const signOut = useCallback(async () => {
    if (recoveryArmed.current) {
      // Ending a recovery: stay on it, marker armed, unless the session is really gone.
      if (!(await endLocalSession())) return false;
      recoveryArmed.current = false;
      await disarmRecovery();
    } else {
      await supabase.auth.signOut();
    }
    if (mounted.current) dispatch({ type: "signed-out" });
    return true;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "cadence://reset-password",
    });
    // Only failures that say nothing about the account are shown (anti-enumeration).
    const message = error ? resetErrorMessage(error) : null;
    // The app now expects a recovery link (see recovery-flag.ts).
    if (!message) await markRecoveryRequested();
    return { error: message };
  }, []);

  const acceptRecoveryLink = useCallback(async (url: string) => {
    const link = parseRecoveryLink(url);
    if (link.kind === "error") return { error: link.message };
    if (link.kind !== "tokens") return { error: EXPIRED_LINK_MESSAGE };
    if (acceptedUrl.current === url && recoveryArmed.current) return { error: null };

    await startup.current;
    if (!(await hasFreshRecoveryRequest())) return { error: NOT_REQUESTED_MESSAGE };

    // Armed before the session exists: a crash in between still ends in a sign-out.
    if (!(await armRecovery())) return { error: LINK_OPEN_FAILED };
    recoveryArmed.current = true;
    const { error } = await supabase.auth.setSession({
      access_token: link.accessToken,
      refresh_token: link.refreshToken,
    });
    if (error) {
      recoveryArmed.current = false;
      await disarmRecovery();
      return { error: EXPIRED_LINK_MESSAGE };
    }
    acceptedUrl.current = url;
    await clearRecoveryRequest();
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? error.message : null };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      state,
      session: sessionOf(state),
      user: sessionOf(state)?.user ?? null,
      profile: profileOf(state),
      loading: isResolving(state),
      refreshProfile,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      acceptRecoveryLink,
    }),
    [
      state,
      refreshProfile,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      acceptRecoveryLink,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
