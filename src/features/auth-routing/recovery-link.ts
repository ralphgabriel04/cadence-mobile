export const EXPIRED_LINK_MESSAGE =
  "Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau.";

export type RecoveryLink =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "code"; code: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

function paramsOf(part: string): URLSearchParams {
  return new URLSearchParams(part);
}

/**
 * Reads what a password-recovery link (cadence://reset-password...) carries.
 * Supabase puts tokens, or an error such as `otp_expired` for a link already
 * used, in the URL fragment; a PKCE flow puts a `code` in the query instead.
 * Pure on purpose: no network, no storage.
 */
export function parseRecoveryLink(url: string | null | undefined): RecoveryLink {
  if (!url) return { kind: "none" };

  const hashAt = url.indexOf("#");
  const queryAt = url.indexOf("?");
  const fragment = hashAt >= 0 ? paramsOf(url.slice(hashAt + 1)) : paramsOf("");
  const queryEnd = hashAt >= 0 ? hashAt : url.length;
  const query = queryAt >= 0 ? paramsOf(url.slice(queryAt + 1, queryEnd)) : paramsOf("");

  if (fragment.get("error") || fragment.get("error_code") || query.get("error")) {
    return { kind: "error", message: EXPIRED_LINK_MESSAGE };
  }

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken && fragment.get("type") === "recovery") {
    return { kind: "tokens", accessToken, refreshToken };
  }

  const code = query.get("code");
  if (code) return { kind: "code", code };

  return { kind: "none" };
}
