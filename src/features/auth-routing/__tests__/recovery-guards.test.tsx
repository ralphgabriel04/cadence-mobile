import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import AthleteLayout from "@/app/(athlete)/_layout";
import AuthLayout from "@/app/(auth)/_layout";
import CoachLayout from "@/app/(coach)/_layout";
import Index from "@/app/index";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { ResetPasswordScreen } from "@/screens/auth/reset-password-screen";

// Real provider and real route guards; only the network client, the router and
// the secure storage are replaced.
const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- factory is synchronous
  const { Text: T } = require("react-native");
  const Shell = ({ children }: { children?: unknown }) => <T>shell{children as never}</T>;
  return {
    router: { replace: (...a: unknown[]) => mockReplace(...a) },
    Redirect: ({ href }: { href: string }) => <T>{`redirect:${href}`}</T>,
    Stack: Object.assign(Shell, { Screen: () => null }),
    Tabs: Object.assign(Shell, { Screen: () => null }),
  };
});
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const mockReplace = jest.fn();
type AuthListener = (event: string, session: unknown) => void;
let mockListener: AuthListener | null = null;
let mockStoredSession: unknown = null;
const mockSignOutClient = jest.fn(async () => {
  mockStoredSession = null;
  return { error: null };
});
const mockFrom = jest.fn();
jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: mockStoredSession } })),
      onAuthStateChange: jest.fn((cb: AuthListener) => {
        mockListener = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      updateUser: jest.fn(async () => ({ error: null })),
      signOut: (...a: unknown[]) => (mockSignOutClient as (...x: unknown[]) => unknown)(...a),
    },
    from: (...a: unknown[]) => mockFrom(...a),
  },
}));

const session = {
  access_token: "t",
  refresh_token: "r",
  user: { id: "u1", app_metadata: {}, user_metadata: {}, aud: "authenticated" },
};
const profile = (role: "athlete" | "coach") => ({
  id: "u1",
  email: "a@cadence.test",
  first_name: "A",
  last_name: "B",
  role,
  avatar_url: null,
  onboarding_completed: true,
});

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <Text>{`status:${api.state.status}`}</Text>;
}

function mountWith(role: "athlete" | "coach", Guard: () => React.JSX.Element | null) {
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: profile(role), error: null }) }),
    }),
  });
  return render(
    <AuthProvider>
      <Probe />
      <Guard />
    </AuthProvider>
  );
}

beforeEach(() => {
  mockStore.clear();
  mockListener = null;
  mockStoredSession = null;
  mockReplace.mockClear();
  mockSignOutClient.mockClear();
});

describe("2.3 · password recovery blocks the app until a new password is set", () => {
  it.each([
    ["athlete", AthleteLayout],
    ["coach", CoachLayout],
  ] as const)(
    "a signed-in %s is sent to the new-password screen on recovery",
    async (role, Guard) => {
      mockStoredSession = session;
      mountWith(role, Guard);
      await waitFor(() => expect(screen.getByText("status:ready")).toBeTruthy());
      expect(screen.queryByText(/redirect:/)).toBeNull(); // control: the guard let the user in

      await act(async () => mockListener?.("PASSWORD_RECOVERY", session));

      expect(screen.getByText("status:recovery")).toBeTruthy();
      expect(screen.getByText("redirect:/reset-password")).toBeTruthy();
    }
  );

  it("the auth group and the entry route send a recovery to the same screen", async () => {
    mockStoredSession = session;
    for (const Guard of [AuthLayout, Index]) {
      const view = mountWith("athlete", Guard);
      await waitFor(() => expect(screen.getByText(/status:ready/)).toBeTruthy());
      await act(async () => mockListener?.("PASSWORD_RECOVERY", session));
      expect(screen.getByText("redirect:/reset-password")).toBeTruthy();
      view.unmount();
      mockStore.clear(); // the open recovery would (rightly) be ended by the next launch
      mockStoredSession = session;
    }
  });

  it("does not load a profile for a recovery session", async () => {
    mountWith("athlete", AthleteLayout);
    await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
    mockFrom.mockClear();

    await act(async () => mockListener?.("PASSWORD_RECOVERY", session));
    await act(async () => mockListener?.("TOKEN_REFRESHED", session));

    expect(screen.getByText("status:recovery")).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("a relaunch with a recovery left open signs the session out before routing", async () => {
    mockStore.set("cadence.recovery-in-progress", "1");
    mockStoredSession = session;
    mountWith("athlete", AthleteLayout);

    await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
    expect(mockSignOutClient).toHaveBeenCalledWith({ scope: "local" });
    expect(mockFrom).not.toHaveBeenCalled(); // the athlete space never opened
    expect(mockStore.has("cadence.recovery-in-progress")).toBe(false);
    expect(screen.getByText("redirect:/(auth)/login")).toBeTruthy();
  });

  it("a normal relaunch (no recovery open) keeps its session", async () => {
    mockStoredSession = session;
    mountWith("athlete", AthleteLayout);
    await waitFor(() => expect(screen.getByText("status:ready")).toBeTruthy());
    expect(mockSignOutClient).not.toHaveBeenCalled();
  });

  it("signing out of a recovery ends it and clears the marker", async () => {
    mountWith("athlete", AthleteLayout);
    await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
    await act(async () => mockListener?.("PASSWORD_RECOVERY", session));
    expect(mockStore.get("cadence.recovery-in-progress")).toBe("1");

    await act(async () => api.signOut());

    expect(screen.getByText("status:signed-out")).toBeTruthy();
    expect(mockStore.has("cadence.recovery-in-progress")).toBe(false);
  });

  it.each(["a saved new password", "cancelling"])(
    "%s ends the recovery and signs out",
    async (how) => {
      mountWith("athlete", () => <ResetPasswordScreen />);
      await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
      await act(async () => mockListener?.("PASSWORD_RECOVERY", session));
      expect(screen.getByText("status:recovery")).toBeTruthy(); // control: the recovery is open
      if (how === "cancelling") {
        await act(async () => fireEvent.press(screen.getByText("Annuler")));
      } else {
        fireEvent.changeText(screen.getByPlaceholderText("Minimum 8 caractères"), "Newpass12");
        fireEvent.changeText(
          screen.getByPlaceholderText("Retapez votre mot de passe"),
          "Newpass12"
        );
        await act(async () => fireEvent.press(screen.getByText("Mettre à jour")));
      }
      await waitFor(() => expect(screen.getByText("status:signed-out")).toBeTruthy());
      expect(mockStore.has("cadence.recovery-in-progress")).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
    }
  );
});
