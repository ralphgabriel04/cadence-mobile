import { GENERIC_SIGN_IN_ERROR, signInErrorMessage } from "../auth-errors";

describe("signInErrorMessage", () => {
  // Critère 2 : même message pour un mauvais courriel et un mauvais mot de passe.
  it("returns the same message for an unknown email and a wrong password", () => {
    const wrongPassword = {
      name: "AuthApiError",
      status: 400,
      code: "invalid_credentials",
      message: "Invalid login credentials",
    };
    const unknownEmail = {
      name: "AuthApiError",
      status: 400,
      code: "invalid_credentials",
      message: "Invalid login credentials",
    };
    expect(signInErrorMessage(wrongPassword)).toBe(signInErrorMessage(unknownEmail));
    expect(signInErrorMessage(wrongPassword)).toBe(GENERIC_SIGN_IN_ERROR);
  });

  it("does not reveal whether the account exists, whatever the server says", () => {
    for (const message of ["User not found", "Invalid password", "Email not confirmed"]) {
      const text = signInErrorMessage({ name: "AuthApiError", status: 400, message });
      expect(text).toBe(GENERIC_SIGN_IN_ERROR);
      expect(text).not.toMatch(/introuvable|n'existe|not found/i);
    }
  });

  it("tells the user to wait on a rate limit", () => {
    expect(
      signInErrorMessage({
        name: "AuthApiError",
        status: 429,
        code: "over_request_rate_limit",
        message: "x",
      })
    ).toMatch(/Trop de tentatives/);
  });

  it("tells the user about a network failure instead of blaming the password", () => {
    expect(
      signInErrorMessage({
        name: "AuthRetryableFetchError",
        status: 0,
        message: "Network request failed",
      })
    ).toMatch(/Connexion impossible/);
  });
});
