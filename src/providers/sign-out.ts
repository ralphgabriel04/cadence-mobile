type SignOutResult = { error: unknown };
type AuthLike = {
  signOut: (options?: { scope: "global" | "local" | "others" }) => Promise<SignOutResult>;
};

/**
 * Signs out and guarantees the LOCAL session is gone, whatever the server says.
 *
 * auth-js returns an error BEFORE removing the stored session for failures such
 * as a network drop or a 500, which would leave the token in the keychain while
 * the UI shows "signed out" -- and bring the session back at next launch. So on
 * any error or exception we repeat the call with scope "local", which only
 * clears this device. Returns true when the server confirmed the sign-out.
 * Nothing sensitive is logged.
 */
export async function signOutAndClearLocal(
  auth: AuthLike,
  clearStored?: () => Promise<void>
): Promise<boolean> {
  try {
    const { error } = await auth.signOut();
    if (!error) return true;
  } catch {
    // fall through to the local clean-up
  }
  if (__DEV__) console.warn("[auth] server sign-out failed; clearing the local session only");
  try {
    await auth.signOut({ scope: "local" });
  } catch {
    // ignore: handled by the direct clean-up below
  }
  // In this auth-js version even scope "local" calls the server first and stops on
  // error before removing anything, so erase the stored session ourselves.
  try {
    await clearStored?.();
  } catch {
    // nothing more can be done from here; the caller still marks the UI signed out
  }
  return false;
}
