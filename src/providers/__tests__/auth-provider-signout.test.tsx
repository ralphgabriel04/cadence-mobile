import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, SIGN_OUT_NOT_CLEARED, useAuth } from "../auth-provider";

const mockSignOut = jest.fn();
const mockClear = jest.fn();
jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: (...a: unknown[]) => mockSignOut(...a),
    },
    from: jest.fn(),
  },
  clearLocalSession: () => mockClear(),
}));

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <Text>{api.state.status}</Text>;
}

beforeEach(async () => {
  const view = render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => expect(view.getByText("signed-out")).toBeTruthy());
});

describe("2.2 · AuthProvider.signOut reports an incomplete clean-up", () => {
  it("returns no error and no notice when the session is erased", async () => {
    mockSignOut.mockResolvedValue({ error: null });
    expect(await api.signOut()).toEqual({ error: null });
    await waitFor(() => expect(api.signOutNotice).toBeNull());
  });

  it("still signs the UI out but warns when the stored session could not be erased", async () => {
    mockSignOut.mockResolvedValue({ error: { message: "500" } });
    mockClear.mockRejectedValue(new Error("keychain locked"));
    expect(await api.signOut()).toEqual({ error: SIGN_OUT_NOT_CLEARED });
    await waitFor(() => expect(api.signOutNotice).toBe(SIGN_OUT_NOT_CLEARED));
    expect(api.state.status).toBe("signed-out");
  });
});
