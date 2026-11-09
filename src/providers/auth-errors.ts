export const GENERIC_SIGN_IN_ERROR = "Courriel ou mot de passe incorrect";
export const RATE_LIMIT_ERROR = "Trop de tentatives. Veuillez réessayer dans quelques minutes.";
export const NETWORK_ERROR = "Connexion impossible. Vérifie ta connexion et réessaie.";

type AuthErrorLike = { name?: string; status?: number; code?: string; message: string };

/**
 * French message for a failed sign-in.
 *
 * Wrong email and wrong password MUST read the same, and so must every other
 * credential failure ("user not found", "email not confirmed"...): a distinct
 * message would let anyone test which addresses are registered (ADR-001).
 * Only failures that say nothing about the account (rate limit, no network) get
 * their own text.
 */
export function signInErrorMessage(error: AuthErrorLike): string {
  if (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    /rate limit/i.test(error.message)
  ) {
    return RATE_LIMIT_ERROR;
  }
  if (error.name === "AuthRetryableFetchError") return NETWORK_ERROR;
  return GENERIC_SIGN_IN_ERROR;
}
