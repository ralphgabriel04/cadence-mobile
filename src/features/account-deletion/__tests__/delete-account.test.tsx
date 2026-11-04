import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, SIGN_OUT_NOT_CLEARED, useAuth } from "@/providers/auth-provider";

// Starts from a real signed-in session, then checks the order of the steps and the final state.
const calls: string[] = [];
const mockRpc = jest.fn();
const mockSignOut = jest.fn();
const mockClearLocal = jest.fn();
const session = { access_token: "t", refresh_token: "r", user: { id: "u1" } };
const profile = {
  id: "u1",
  email: "a@cadence.test",
  first_name: "A",
  last_name: "B",
  role: "athlete",
  avatar_url: null,
  onboarding_completed: true,
};

jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: (...a: unknown[]) => mockSignOut(...a),
    },
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }),
    }),
  },
  clearLocalSession: () => mockClearLocal(),
}));

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <Text>{api.state.status}</Text>;
}

beforeEach(async () => {
  calls.length = 0;
  mockRpc.mockImplementation(async () => {
    calls.push("rpc");
    return { data: null, error: null };
  });
  mockSignOut.mockImplementation(async () => {
    calls.push("sign-out");
    return { error: null };
  });
  mockClearLocal.mockResolvedValue(undefined);
  const view = render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => expect(view.getByText("ready")).toBeTruthy());
});

describe("2.6 (b) · AuthProvider.deleteAccount", () => {
  it("calls delete_my_account with no argument, then signs out", async () => {
    expect(await api.deleteAccount()).toEqual({ error: null });
    expect(mockRpc).toHaveBeenCalledWith("delete_my_account");
    expect(mockRpc.mock.calls[0]).toHaveLength(1);
    expect(calls).toEqual(["rpc", "sign-out"]);
    await waitFor(() => expect(api.state.status).toBe("signed-out"));
    expect(api.signOutNotice).toBeNull();
  });

  it("still reports success and signs out when the sign-out returns an error", async () => {
    mockSignOut.mockResolvedValue({ error: { message: "403 user not found" } });
    expect(await api.deleteAccount()).toEqual({ error: null });
    await waitFor(() => expect(api.state.status).toBe("signed-out"));
    expect(mockClearLocal).toHaveBeenCalled(); // the stored session is erased directly
    expect(api.signOutNotice).toBeNull();
  });

  it("still reports success when the sign-out call is rejected", async () => {
    mockSignOut.mockRejectedValue(new Error("Network request failed"));
    expect(await api.deleteAccount()).toEqual({ error: null });
    await waitFor(() => expect(api.state.status).toBe("signed-out"));
    expect(mockClearLocal).toHaveBeenCalled();
  });

  it("does not call the deletion a failure when only the local clean-up fails; tells the user instead", async () => {
    mockSignOut.mockResolvedValue({ error: { message: "500" } });
    mockClearLocal.mockRejectedValue(new Error("keychain locked"));
    expect(await api.deleteAccount()).toEqual({ error: null });
    await waitFor(() => expect(api.state.status).toBe("signed-out"));
    expect(api.signOutNotice).toBe(SIGN_OUT_NOT_CLEARED);
  });

  it("keeps the session, with a French message, when the function fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not authenticated" } });
    const { error } = await api.deleteAccount();
    expect(error).toMatch(/échoué|Réessaie/);
    expect(error).not.toMatch(/not authenticated|42501/);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(api.state.status).toBe("ready");
  });

  it("keeps the session when the call is rejected", async () => {
    mockRpc.mockRejectedValue(new Error("Network request failed"));
    expect((await api.deleteAccount()).error).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(api.state.status).toBe("ready");
  });
});
