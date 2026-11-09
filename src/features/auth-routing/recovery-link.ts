export const EXPIRED_LINK_MESSAGE =
  "Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau.";

export const NOT_REQUESTED_MESSAGE =
  "Ce lien ne vient pas d'une demande faite depuis cet appareil. Demande un nouveau lien ici.";

export type RecoveryLink =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

/** The only destination a recovery email may open (redirect URL of supabase/config.toml). */
const DESTINATION = /^cadence:\/\/reset-password(?=[?#]|$)/;

/**
 * Reads what a password-recovery link carries. Pure on purpose: no network, no
 * storage.
 *
 * - Only the exact destination cadence://reset-password is read: another scheme,
 *   host or path, or a lookalike (reset-passwordx, reset-password/x), gives `none`.
 * - Tokens are accepted from the fragment only, and only with type=recovery. A
 *   signup, magic-link, invite or email-change fragment gives `none`.
 * - A `code` in the query is never accepted: the app uses the implicit flow and
 *   starts no code exchange, so a code did not come from our recovery request.
 * - An error (otp_expired for a link already used) gives `error`.
 *
 * `type` is a label the caller controls, so it is not proof of origin. Origin is
 * checked by the provider (a recent request from this device) and by the server
 * (the tokens must be valid).
 */
export function parseRecoveryLink(url: string | null | undefined): RecoveryLink {
  if (!url || !DESTINATION.test(url)) return { kind: "none" };

  const hashAt = url.indexOf("#");
  const queryAt = url.indexOf("?");
  const fragment = new URLSearchParams(hashAt >= 0 ? url.slice(hashAt + 1) : "");
  const query = new URLSearchParams(
    queryAt >= 0 ? url.slice(queryAt + 1, hashAt >= 0 ? hashAt : undefined) : ""
  );

  if (fragment.get("error") || fragment.get("error_code") || query.get("error")) {
    return { kind: "error", message: EXPIRED_LINK_MESSAGE };
  }

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  const tokenType = fragment.get("token_type");
  if (
    accessToken &&
    refreshToken &&
    fragment.get("type") === "recovery" &&
    (tokenType === null || tokenType.toLowerCase() === "bearer")
  ) {
    return { kind: "tokens", accessToken, refreshToken };
  }

  return { kind: "none" };
}
