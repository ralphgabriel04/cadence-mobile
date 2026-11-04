import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, useAuth } from "../auth-provider";

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

type AuthListener = (event: string, session: unknown) => void;
let mockListener: AuthListener | null = null;
const session = { access_token: "t", refresh_token: "r", user: { id: "u1" } };
const mockSetSession = jest.fn();
const mockResetForEmail = jest.fn();
jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn((cb: AuthListener) => {
        mockListener = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      setSession: (...a: unknown[]) => mockSetSession(...a),
      resetPasswordForEmail: (...a: unknown[]) => mockResetForEmail(...a),
      signOut: jest.fn(async () => ({ error: null })),
    },
    from: jest.fn(),
  },
}));

const TOKENS = "access_token=AAA&refresh_token=BBB&token_type=bearer";
const RECOVERY = `cadence://reset-password#${TOKENS}&type=recovery`;
const ARMED = "cadence.recovery-in-progress";

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <Text>{`status:${api.state.status}`}</Text>;
}

beforeEach(async () => {
  mockStore.clear();
  mockResetForEmail.mockResolvedValue({ data: {}, error: null });
  // Like supabase-js: a new session is announced to the auth listener.
  mockSetSession.mockImplementation(async () => {
    mockListener?.("SIGNED_IN", session);
    return { data: { session }, error: null };
  });
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
});

describe("2.3 · acceptRecoveryLink only opens a recovery the app asked for", () => {
  it("refuses a valid-looking link when this device never asked for one", async () => {
    let result: { error: string | null } | undefined;
    await act(async () => void (result = await api.acceptRecoveryLink(RECOVERY)));
    expect(result?.error).toMatch(/demande/);
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockStore.has(ARMED)).toBe(false);
    expect(screen.getByText("status:signed-out")).toBeTruthy();
  });

  it("after a request, turns the link into a recovery session (never a normal one)", async () => {
    await act(async () => void (await api.resetPassword("a@cadence.test")));
    let result: { error: string | null } | undefined;
    await act(async () => void (result = await api.acceptRecoveryLink(RECOVERY)));

    expect(result).toEqual({ error: null });
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: "AAA", refresh_token: "BBB" });
    expect(screen.getByText("status:recovery")).toBeTruthy();
    expect(mockStore.get(ARMED)).toBe("1");
  });

  it.each([
    ["signup", `cadence://reset-password#${TOKENS}&type=signup`],
    ["magic link", `cadence://reset-password#${TOKENS}&type=magiclink`],
    ["PKCE code", "cadence://reset-password?code=3f2a9c1e"],
  ])("refuses a %s link even right after a request", async (_n, url) => {
    await act(async () => void (await api.resetPassword("a@cadence.test")));
    await act(async () => void (await api.acceptRecoveryLink(url)));
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(screen.getByText("status:signed-out")).toBeTruthy();
  });

  it("refuses a request older than an hour", async () => {
    await act(async () => void (await api.resetPassword("a@cadence.test")));
    const later = Date.now() + 61 * 60 * 1000;
    const clock = jest.spyOn(Date, "now").mockReturnValue(later);
    await act(async () => void (await api.acceptRecoveryLink(RECOVERY)));
    clock.mockRestore();
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("does not remember a failed request, and leaves nothing armed when the server refuses", async () => {
    mockResetForEmail.mockResolvedValueOnce({
      data: {},
      error: { name: "AuthApiError", status: 429, code: "over_email_send_rate_limit", message: "x" },
    });
    await act(async () => void (await api.resetPassword("a@cadence.test")));
    await act(async () => void (await api.acceptRecoveryLink(RECOVERY)));
    expect(mockSetSession).not.toHaveBeenCalled();

    await act(async () => void (await api.resetPassword("a@cadence.test")));
    mockSetSession.mockResolvedValueOnce({ data: { session: null }, error: { message: "expired" } });
    let result: { error: string | null } | undefined;
    await act(async () => void (result = await api.acceptRecoveryLink(RECOVERY)));
    expect(result?.error).toMatch(/expiré|déjà été utilisé/);
    expect(mockStore.has(ARMED)).toBe(false);
    expect(screen.getByText("status:signed-out")).toBeTruthy();
  });

  it("a link is used once: the request is consumed by a successful acceptance", async () => {
    await act(async () => void (await api.resetPassword("a@cadence.test")));
    await act(async () => void (await api.acceptRecoveryLink(RECOVERY)));
    await act(async () => void (await api.signOut()));
    mockSetSession.mockClear();
    await act(async () => void (await api.acceptRecoveryLink(RECOVERY)));
    expect(mockSetSession).not.toHaveBeenCalled();
  });
});
