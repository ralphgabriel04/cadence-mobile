import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, useAuth } from "@/providers/auth-provider";

const mockRpc = jest.fn();
const mockSignOut = jest.fn();
jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: (...a: unknown[]) => mockSignOut(...a),
    },
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: jest.fn(),
  },
}));

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <Text>{api.state.status}</Text>;
}

beforeEach(async () => {
  mockSignOut.mockResolvedValue({ error: null });
  const view = render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => expect(view.getByText("signed-out")).toBeTruthy());
});

describe("2.6 (b) · AuthProvider.deleteAccount", () => {
  it("calls delete_my_account with no argument, then ends the session", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await api.deleteAccount()).toEqual({ error: null });
    expect(mockRpc).toHaveBeenCalledWith("delete_my_account");
    expect(mockRpc.mock.calls[0]).toHaveLength(1);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("does not sign out and returns a French message when the function fails", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "not authenticated" },
    });
    const { error } = await api.deleteAccount();
    expect(error).toMatch(/échoué|Réessaie/);
    expect(error).not.toMatch(/not authenticated|42501/);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("reports a thrown network error without signing out", async () => {
    mockRpc.mockRejectedValue(new Error("Network request failed"));
    expect((await api.deleteAccount()).error).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
