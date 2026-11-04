import { parseRecoveryLink } from "../recovery-link";

describe("parseRecoveryLink", () => {
  it("reads access and refresh tokens from the fragment of a recovery link", () => {
    expect(
      parseRecoveryLink("cadence://reset-password#access_token=AAA&refresh_token=BBB&type=recovery")
    ).toEqual({ kind: "tokens", accessToken: "AAA", refreshToken: "BBB" });
  });

  it("reads a PKCE code from the query", () => {
    expect(parseRecoveryLink("cadence://reset-password?code=abc123")).toEqual({
      kind: "code",
      code: "abc123",
    });
  });

  // Critère 4 : lien déjà utilisé ou expiré.
  it("reports an already-used link as expired, never as tokens", () => {
    const link = parseRecoveryLink(
      "cadence://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );
    expect(link.kind).toBe("error");
    if (link.kind === "error") expect(link.message).toMatch(/expiré|déjà été utilisé/);
  });

  it.each([
    null,
    undefined,
    "",
    "cadence://reset-password",
    "cadence://reset-password#type=signup",
  ])("returns none when there is nothing to use (%p)", (url) => {
    expect(parseRecoveryLink(url as string | null).kind).toBe("none");
  });
});
