type AuthErrorLike = { name?: string; status?: number; code?: string; message: string };

/**
 * Error text for a password-reset request, or null when nothing should be shown.
 * Server messages such as "User not found" would reveal who has an account, so
 * only a rate limit and a network failure are reported; every other outcome reads
 * as success ("Si un compte existe pour ce courriel...").
 */
export function resetErrorMessage(error: AuthErrorLike): string | null {
  if (
    error.status === 429 ||
    /rate limit/i.test(error.message) ||
    error.code?.includes("rate_limit")
  ) {
    return "Trop de tentatives. Veuillez réessayer dans quelques minutes.";
  }
  if (error.name === "AuthRetryableFetchError") {
    return "Connexion impossible. Vérifie ta connexion et réessaie.";
  }
  return null;
}
