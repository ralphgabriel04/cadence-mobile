import { Platform } from "react-native";

export const EXPIRED_LINK_MESSAGE =
  "Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau.";

export const NOT_REQUESTED_MESSAGE =
  "Ce lien ne vient pas d'une demande faite depuis cet appareil. Demande un nouveau lien ici.";

export type RecoveryLink =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

/** The only destination a recovery email may open in the app (redirect URL of supabase/config.toml). */
export const NATIVE_RECOVERY_URL = "cadence://reset-password";
const DESTINATION = /^cadence:\/\/reset-password(?=[?#]|$)/;

/** Origin of the site when the app runs in a browser (Expo web), otherwise null. */
export function currentWebOrigin(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return window.location?.origin ?? null;
}

/**
 * Where the recovery email sends the user: the app scheme on a phone, this
 * site's own /reset-password page on the web (a browser cannot open cadence://).
 */
export function recoveryRedirectUrl(webOrigin: string | null = currentWebOrigin()): string {
  return webOrigin ? `${webOrigin}/reset-password` : NATIVE_RECOVERY_URL;
}

function isDestination(url: string, webOrigin: string | null): boolean {
  if (DESTINATION.test(url)) return true;
  if (!webOrigin) return false;
  const page = `${webOrigin}/reset-password`;
  return url.startsWith(page) && /^([?#]|$)/.test(url.slice(page.length));
}

/**
 * Reads what a password-recovery link carries. Pure on purpose: no network, no
 * storage.
 *
 * - Only the exact destination cadence://reset-password is read (on the web: this
 *   site's own /reset-password page): another scheme, host or path, or a
 *   lookalike (reset-passwordx, reset-password/x), gives `none`.
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
export function parseRecoveryLink(
  url: string | null | undefined,
  webOrigin: string | null = currentWebOrigin()
): RecoveryLink {
  if (!url || !isDestination(url, webOrigin)) return { kind: "none" };

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
