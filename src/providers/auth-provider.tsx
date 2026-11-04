import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { type Session, type User } from "@supabase/supabase-js";

import { clearLocalSession, supabase } from "@/config/supabase";
import { DELETION_FAILED } from "@/features/account-deletion/deletion-copy";
import { purgeLocalSetQueue } from "@/services/purge-local-queue";

import { signInErrorMessage } from "./auth-errors";
import { signOutAndClearLocal } from "./sign-out";

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

export const SIGN_OUT_NOT_CLEARED =
  "La déconnexion n'a pas pu effacer la session de cet appareil. Réessaie.";

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
  /** Always ends the UI session. `error` is set when this device could not erase the stored session. */
  signOut: () => Promise<{ error: string | null }>;
  /** Last sign-out problem, shown on the login screen; cleared by the next sign-in. */
  signOutNotice: string | null;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** Deletes the signed-in account and all its data (public.delete_my_account), then ends the session. */
  deleteAccount: () => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

/** PostgREST code for "expected exactly one row, got none". */
const PGRST_NO_ROWS = "PGRST116";

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
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted.current) return;
        dispatch({ type: "session-resolved", session });
      })
      .catch((cause: unknown) => {
        if (!mounted.current) return;
        // Without this the app hung on the splash forever when the auth client
        // failed -- the previous implementation had no rejection handler at all,
        // so `loading` was never cleared.
        dispatch({
          type: "session-resolved",
          session: null,
        });
        if (__DEV__) {
          console.warn("[auth] getSession failed", cause);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted.current) return;
      if (event === "SIGNED_OUT" || !session) {
        dispatch({ type: "signed-out" });
        return;
      }
      dispatch({ type: "session-resolved", session });
    });

    return () => subscription.unsubscribe();
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
    setSignOutNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Wrong email and wrong password read the same (ADR-001); see auth-errors.ts.
      return { error: signInErrorMessage(error) };
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

  const [signOutNotice, setSignOutNotice] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    const outcome = await signOutAndClearLocal(supabase.auth, clearLocalSession);
    // The UI always ends the session, but never claims the token is gone when it may not be.
    const error = outcome.localCleared ? null : SIGN_OUT_NOT_CLEARED;
    if (mounted.current) {
      setSignOutNotice(error);
      dispatch({ type: "signed-out" });
    }
    return { error };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "cadence://reset-password",
    });
    return { error: error ? error.message : null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? error.message : null };
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) return { error: DELETION_FAILED };
    } catch {
      return { error: DELETION_FAILED };
    }
    // The account no longer exists, so the deletion has succeeded whatever happens
    // on this device from here: erase its unsent sets, then end the session with the
    // same reliable sign-out as the Réglages button (it clears the local session even
    // if the server call fails). A local clean-up problem shows as the sign-out
    // notice on the login screen, never as a failed deletion.
    purgeLocalSetQueue();
    try {
      await signOut();
    } catch {
      if (mounted.current) dispatch({ type: "signed-out" });
    }
    return { error: null };
  }, [signOut]);

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
      signOutNotice,
      resetPassword,
      deleteAccount,
      updatePassword,
    }),
    [
      state,
      refreshProfile,
      signIn,
      signUp,
      signOut,
      signOutNotice,
      resetPassword,
      deleteAccount,
      updatePassword,
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
