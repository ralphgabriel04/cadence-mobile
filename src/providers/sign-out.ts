type SignOutResult = { error: unknown };
type AuthLike = {
  signOut: (options?: { scope: "global" | "local" | "others" }) => Promise<SignOutResult>;
};

export type SignOutOutcome = {
  /** The server confirmed the sign-out. */
  serverConfirmed: boolean;
  /** The session is known to be gone from this device's storage. */
  localCleared: boolean;
};

async function attempt(fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}

/**
 * Signs out and tries to guarantee the LOCAL session is gone, whatever the server says.
 *
 * auth-js returns an error BEFORE removing the stored session for failures such
 * as a network drop or a 500, which would leave the token in the keychain while
 * the UI shows "signed out" -- and bring the session back at next launch. So on
 * any error or exception we retry with scope "local", then erase the stored
 * session directly (one retry). `localCleared` is false when that clean-up could
 * not be done, so the caller can say so instead of pretending. Nothing sensitive
 * is logged.
 */
export async function signOutAndClearLocal(
  auth: AuthLike,
  clearStored?: () => Promise<void>
): Promise<SignOutOutcome> {
  try {
    const { error } = await auth.signOut();
    if (!error) return { serverConfirmed: true, localCleared: true };
  } catch {
    // fall through to the local clean-up
  }
  if (__DEV__) console.warn("[auth] server sign-out failed; clearing the local session only");
  await attempt(async () => {
    await auth.signOut({ scope: "local" });
  });
  // In this auth-js version even scope "local" calls the server first and stops on
  // error before removing anything, so erase the stored session ourselves.
  if (!clearStored) return { serverConfirmed: false, localCleared: false };
  const cleared = (await attempt(clearStored)) || (await attempt(clearStored));
  return { serverConfirmed: false, localCleared: cleared };
}
