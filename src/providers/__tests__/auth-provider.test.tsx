import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, useAuth } from "../auth-provider";

const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
let authCallback: ((event: string, session: unknown) => void) | undefined;

jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn((cb: (e: string, s: unknown) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      signInWithPassword: (...a: unknown[]) => mockSignIn(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a),
    },
    from: jest.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "aaaaaaaa-0000-4000-8000-000000000001",
              email: "athlete@cadence.test",
              first_name: "Alex",
              last_name: "Test",
              role: "athlete",
              avatar_url: null,
              onboarding_completed: false,
            },
            error: null,
          }),
        }),
      }),
    })),
  },
}));

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <Text>{api.state.status}</Text>;
}

async function mountSignedOut() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => expect(screen.getByText("signed-out")).toBeTruthy());
}

describe("2.2 · AuthProvider sign-in", () => {
  it("gives the same message for an unknown email and a wrong password", async () => {
    await mountSignedOut();
    const credentials = {
      name: "AuthApiError",
      status: 400,
      code: "invalid_credentials",
      message: "Invalid login credentials",
    };
    mockSignIn.mockResolvedValueOnce({ error: credentials });
    const a = await api.signIn("inconnu@cadence.test", "motdepasse1");
    mockSignIn.mockResolvedValueOnce({ error: credentials });
    const b = await api.signIn("athlete@cadence.test", "mauvais-mot-de-passe");
    expect(a.error).toBe(b.error);
    expect(a.error).toBe("Courriel ou mot de passe incorrect");
  });

  it("returns no error on success", async () => {
    await mountSignedOut();
    mockSignIn.mockResolvedValueOnce({ error: null });
    expect((await api.signIn("athlete@cadence.test", "bonmotdepasse")).error).toBeNull();
  });

  // Critère 4 : après déconnexion, plus de session dans l'état -> les gardes renvoient au login.
  it("signOut clears the session from state so guards redirect to login", async () => {
    await mountSignedOut();
    const user = { id: "aaaaaaaa-0000-4000-8000-000000000001", email: "athlete@cadence.test" };
    authCallback?.("SIGNED_IN", { user, access_token: "t", refresh_token: "r" });
    await waitFor(() => expect(api.state.status).not.toBe("signed-out"));

    mockSignOut.mockResolvedValueOnce({ error: null });
    await api.signOut();
    await waitFor(() => expect(screen.getByText("signed-out")).toBeTruthy());
    expect(api.session).toBeNull();
    expect(api.profile).toBeNull();
  });
});
