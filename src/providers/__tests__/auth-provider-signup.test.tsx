import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, useAuth } from "../auth-provider";

const mockSignUp = jest.fn();

jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signUp: (...a: unknown[]) => mockSignUp(...a),
    },
    from: jest.fn(),
  },
}));

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <Text>{api.state.status}</Text>;
}

const PARAMS = {
  email: "alex@cadence.test",
  password: "motdepasse8",
  firstName: "Alex",
  lastName: "Test",
  role: "coach" as const,
};

async function mount() {
  const view = render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => expect(view.getByText("signed-out")).toBeTruthy());
}

describe("2.1 · real AuthProvider.signUp (Supabase client mocked at the boundary)", () => {
  it("sends role, first_name and last_name in options.data", async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null });
    await mount();
    expect((await api.signUp(PARAMS)).error).toBeNull();
    expect(mockSignUp).toHaveBeenCalledWith({
      email: PARAMS.email,
      password: PARAMS.password,
      options: { data: { first_name: "Alex", last_name: "Test", role: "coach" } },
    });
  });

  // Anti-énumération : un courriel déjà inscrit donne le même résultat public.
  it.each([
    ["User already registered", "user_already_exists"],
    ["A user with this email address has already been registered", undefined],
  ])("treats an already-registered address like a new one (%s)", async (message, code) => {
    mockSignUp.mockResolvedValue({
      data: {},
      error: { name: "AuthApiError", status: 422, code, message },
    });
    await mount();
    expect(await api.signUp(PARAMS)).toEqual({ error: null });
  });

  it("never shows an unknown server message as is", async () => {
    mockSignUp.mockResolvedValue({
      data: {},
      error: {
        name: "AuthApiError",
        status: 500,
        message: "duplicate key value violates unique constraint profiles_email_key",
      },
    });
    await mount();
    const { error } = await api.signUp(PARAMS);
    expect(error).toBeTruthy();
    expect(error).not.toMatch(/duplicate|constraint|profiles/i);
  });

  it("translates rate limit and network failures", async () => {
    await mount();
    mockSignUp.mockResolvedValueOnce({
      data: {},
      error: {
        name: "AuthApiError",
        status: 429,
        code: "over_email_send_rate_limit",
        message: "x",
      },
    });
    expect((await api.signUp(PARAMS)).error).toMatch(/Trop de tentatives/);
    mockSignUp.mockResolvedValueOnce({
      data: {},
      error: { name: "AuthRetryableFetchError", status: 0, message: "Network request failed" },
    });
    expect((await api.signUp(PARAMS)).error).toMatch(/Connexion impossible/);
  });
});
