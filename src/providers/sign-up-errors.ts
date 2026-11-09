type AuthErrorLike = { name?: string; status?: number; code?: string; message: string };

export const SIGN_UP_RATE_LIMIT = "Trop de tentatives. Veuillez réessayer dans quelques minutes.";
export const SIGN_UP_NETWORK = "Connexion impossible. Vérifie ta connexion et réessaie.";
export const SIGN_UP_GENERIC =
  "Impossible de créer le compte pour le moment. Réessaie dans un instant.";

/** True when the server says the address already has an account. */
export function isAlreadyRegistered(error: AuthErrorLike): boolean {
  return error.code === "user_already_exists" || /already (been )?registered/i.test(error.message);
}

/**
 * Message shown after a failed sign-up. Never the raw server text, and never a
 * hint that the address is taken: an already-registered address is handled by the
 * caller as a success, so both cases end on the same "check your inbox" screen.
 * French text to be reviewed by Ralph.
 */
export function signUpErrorMessage(error: AuthErrorLike): string {
  if (
    error.status === 429 ||
    /rate limit/i.test(error.message) ||
    error.code?.includes("rate_limit")
  ) {
    return SIGN_UP_RATE_LIMIT;
  }
  if (error.name === "AuthRetryableFetchError") return SIGN_UP_NETWORK;
  return SIGN_UP_GENERIC;
}
