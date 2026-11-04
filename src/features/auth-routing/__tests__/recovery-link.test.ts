import { parseRecoveryLink } from "../recovery-link";

const TOKENS = "access_token=AAA&refresh_token=BBB&expires_in=3600&token_type=bearer";

describe("parseRecoveryLink", () => {
  it("reads access and refresh tokens from the fragment of a recovery link", () => {
    expect(parseRecoveryLink(`cadence://reset-password#${TOKENS}&type=recovery`)).toEqual({
      kind: "tokens",
      accessToken: "AAA",
      refreshToken: "BBB",
    });
  });

  // Critère 4 : lien déjà utilisé ou expiré.
  it.each([
    "cadence://reset-password#error=access_denied&error_code=otp_expired&error_description=x",
    "cadence://reset-password?error=access_denied&error_code=otp_expired",
  ])("reports an already-used link as expired, never as tokens (%s)", (url) => {
    const link = parseRecoveryLink(url);
    expect(link.kind).toBe("error");
    if (link.kind === "error") expect(link.message).toMatch(/expiré|déjà été utilisé/);
  });

  // R2 : liens réalistes qui ne doivent pas ouvrir une récupération.
  it.each([
    ["signup confirmation", `cadence://reset-password#${TOKENS}&type=signup`],
    ["magic link", `cadence://reset-password#${TOKENS}&type=magiclink`],
    ["invite", `cadence://reset-password#${TOKENS}&type=invite`],
    ["email change", `cadence://reset-password#${TOKENS}&type=email_change`],
    ["no type", `cadence://reset-password#${TOKENS}`],
    ["PKCE code of a signup or magic link", "cadence://reset-password?code=3f2a9c1e-5b7d-4e08"],
    ["signup tokens on the sign-in route", `cadence://login#${TOKENS}&type=recovery`],
    ["other scheme", `https://evil.test/reset-password#${TOKENS}&type=recovery`],
    ["lookalike host", `cadence://reset-passwordx#${TOKENS}&type=recovery`],
    ["extra path", `cadence://reset-password/extra#${TOKENS}&type=recovery`],
    ["not a bearer token", "cadence://reset-password#access_token=A&refresh_token=B&token_type=mac&type=recovery"],
  ])("refuses %s", (_name, url) => {
    expect(parseRecoveryLink(url).kind).toBe("none");
  });

  it.each([null, undefined, "", "cadence://reset-password", "cadence://reset-password#type=recovery"])(
    "returns none when there is nothing to use (%p)",
    (url) => {
      expect(parseRecoveryLink(url as string | null).kind).toBe("none");
    }
  );
});
