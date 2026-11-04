import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, useAuth } from "../auth-provider";

const mockReset = jest.fn();
jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      resetPasswordForEmail: (...a: unknown[]) => mockReset(...a),
    },
    from: jest.fn(),
  },
}));

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <Text>{api.state.status}</Text>;
}

describe("2.3 · resetPassword reveals nothing about the account", () => {
  beforeEach(async () => {
    const view = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(view.getByText("signed-out")).toBeTruthy());
  });

  it("asks Supabase to send the link to the app deep link", async () => {
    mockReset.mockResolvedValue({ data: {}, error: null });
    expect(await api.resetPassword("a@cadence.test")).toEqual({ error: null });
    expect(mockReset).toHaveBeenCalledWith("a@cadence.test", {
      redirectTo: "cadence://reset-password",
    });
  });

  it.each([
    "User not found",
    "Unable to validate email address: invalid format",
    "Error sending recovery email",
  ])("swallows account-related server messages (%s)", async (message) => {
    mockReset.mockResolvedValue({
      data: {},
      error: { name: "AuthApiError", status: 400, message },
    });
    expect(await api.resetPassword("inconnu@cadence.test")).toEqual({ error: null });
  });

  it("still reports a rate limit and a network failure", async () => {
    mockReset.mockResolvedValueOnce({
      data: {},
      error: {
        name: "AuthApiError",
        status: 429,
        code: "over_email_send_rate_limit",
        message: "x",
      },
    });
    expect((await api.resetPassword("a@cadence.test")).error).toMatch(/Trop de tentatives/);
    mockReset.mockResolvedValueOnce({
      data: {},
      error: { name: "AuthRetryableFetchError", status: 0, message: "Network request failed" },
    });
    expect((await api.resetPassword("a@cadence.test")).error).toMatch(/Connexion impossible/);
  });
});
