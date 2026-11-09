import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, useAuth } from "../auth-provider";

// R1 (fail closed): storage and sign-out failures never leave a recovery session
// usable as an ordinary login.
const ARMED = "cadence.recovery-in-progress";
const mockStore = new Map<string, string>();
let mockFailSet = false;
let mockFailGet = false;
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => {
    if (mockFailGet && k === ARMED) throw new Error("keychain locked");
    return mockStore.get(k) ?? null;
  }),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    if (mockFailSet && k === ARMED) throw new Error("keychain full");
    mockStore.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

type AuthListener = (event: string, session: unknown) => void;
let mockListener: AuthListener | null = null;
let mockStored: unknown = null;
const mockSetSession = jest.fn();
const mockSignOut = jest.fn();
jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: mockStored } })),
      onAuthStateChange: jest.fn((cb: AuthListener) => {
        mockListener = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      setSession: (...a: unknown[]) => mockSetSession(...a),
      resetPasswordForEmail: jest.fn(async () => ({ data: {}, error: null })),
      signOut: (...a: unknown[]) => mockSignOut(...a),
    },
    from: jest.fn(),
  },
}));

const session = { access_token: "t", refresh_token: "r", user: { id: "u1" } };
const LINK = "cadence://reset-password#access_token=AAA&refresh_token=BBB&type=recovery";
const clearsStore = async () => {
  mockStored = null;
  return { error: null };
};

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <Text>{`status:${api.state.status}`}</Text>;
}
const mount = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

beforeEach(() => {
  mockStore.clear();
  mockFailSet = false;
  mockFailGet = false;
  mockStored = null;
  mockSignOut.mockReset().mockImplementation(clearsStore);
  mockSetSession.mockReset().mockImplementation(async () => ({ data: { session }, error: null }));
});

describe("2.3 · R1 · a recovery fails closed", () => {
  it("does not install the recovery session when the marker cannot be written", async () => {
    mount();
    await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
    await act(async () => void (await api.resetPassword("a@cadence.test")));
    mockFailSet = true;
    let result: { error: string | null } | undefined;
    await act(async () => void (result = await api.acceptRecoveryLink(LINK)));

    expect(result?.error).toBe("Impossible d'ouvrir le lien, réessaie");
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(screen.getByText("status:signed-out")).toBeTruthy();
  });

  it("control: with a working store the same link is accepted", async () => {
    mount();
    await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
    await act(async () => void (await api.resetPassword("a@cadence.test")));
    await act(async () => void (await api.acceptRecoveryLink(LINK)));
    expect(mockSetSession).toHaveBeenCalled();
    expect(mockStore.get(ARMED)).toBe("1");
  });

  it("an unreadable marker at startup ends the stored session instead of resuming it", async () => {
    mockStored = session;
    mockFailGet = true;
    mount();
    await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("a sign-out that rejects at startup keeps the app on the recovery screen", async () => {
    mockStored = session;
    mockStore.set(ARMED, "1");
    mockSignOut.mockRejectedValue(new Error("offline"));
    mount();
    await waitFor(() => expect(screen.getByText("status:recovery")).toBeTruthy());
    expect(mockStore.get(ARMED)).toBe("1"); // not disarmed
  });

  it("a sign-out that returns an error and leaves the session keeps the recovery", async () => {
    mockStored = session;
    mockStore.set(ARMED, "1");
    mockSignOut.mockResolvedValue({ error: new Error("500") });
    mount();
    await waitFor(() => expect(screen.getByText("status:recovery")).toBeTruthy());
    expect(mockStore.get(ARMED)).toBe("1");
  });

  it("control: a sign-out that really clears the session disarms and signs out", async () => {
    mockStored = session;
    mockStore.set(ARMED, "1");
    mount();
    await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
    expect(mockStore.has(ARMED)).toBe(false);
  });

  it("leaving an open recovery reports failure and stays on it when the session is not cleared", async () => {
    mount();
    await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
    await act(async () => mockListener?.("PASSWORD_RECOVERY", session));
    mockStored = session;
    mockSignOut.mockResolvedValue({ error: new Error("500") });
    let done: { error: string | null } | undefined = undefined;
    await act(async () => void (done = await api.signOut()));

    expect(done?.error).toBeTruthy();
    expect(screen.getByText("status:recovery")).toBeTruthy();
    expect(mockStore.get(ARMED)).toBe("1");
  });
});
