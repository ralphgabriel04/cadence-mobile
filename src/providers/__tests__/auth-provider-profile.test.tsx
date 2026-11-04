import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";

import Index from "@/app/index";
import { AuthProvider } from "../auth-provider";

const mockUserId = "aaaaaaaa-0000-4000-8000-000000000001";
const mockSession = {
  access_token: "t",
  refresh_token: "r",
  user: { id: mockUserId, email: "a@cadence.test" },
};
const mockProfile = {
  id: mockUserId,
  email: "a@cadence.test",
  first_name: "Alex",
  last_name: "Test",
  role: "athlete",
  avatar_url: null,
  onboarding_completed: false,
};

type Answer = { data: unknown; error: unknown };
const mockQueue: Array<(v: Answer) => void> = [];
const mockCalls = { profiles: 0 };
let mockImpl: () => Promise<Answer>;

jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: mockSession } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            mockCalls.profiles += 1;
            return mockImpl();
          },
        }),
      }),
    })),
  },
}));

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- factory must be synchronous
  const { Text } = require("react-native");
  return { Redirect: ({ href }: { href: string }) => <Text>{`REDIRECT:${href}`}</Text> };
});

function mount() {
  return render(
    <AuthProvider>
      <Index />
    </AuthProvider>
  );
}

beforeEach(() => {
  mockQueue.length = 0;
  mockCalls.profiles = 0;
});

describe("2.4 · real AuthProvider with a mocked Supabase client", () => {
  it("shows the loader (no redirect) while the profile is slow, then goes to the athlete group", async () => {
    mockImpl = () => new Promise<Answer>((resolve) => mockQueue.push(resolve));
    const view = mount();

    await waitFor(() => expect(mockCalls.profiles).toBe(1));
    expect(view.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByText(/REDIRECT/)).toBeNull();

    mockQueue[0]({ data: mockProfile, error: null });
    expect(await screen.findByText("REDIRECT:/(athlete)")).toBeTruthy();
  });

  it("sends a coach to the coach group once the profile resolves", async () => {
    mockImpl = async () => ({ data: { ...mockProfile, role: "coach" }, error: null });
    mount();
    expect(await screen.findByText("REDIRECT:/(coach)")).toBeTruthy();
  });

  it("a rejected profile request ends in the retryable error state, not the loader", async () => {
    mockImpl = () => Promise.reject(new Error("Network request failed"));
    mount();
    // error state routes to the athlete group, whose layout shows the retry UI
    expect(await screen.findByText("REDIRECT:/(athlete)")).toBeTruthy();
    expect(mockCalls.profiles).toBe(1);
  });
});

describe("2.4 · missing profile then retry (real provider, real recovery screen)", () => {
  it("fires a second profiles request when Réessayer is pressed", async () => {
    mockImpl = async () => ({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- late import after mocks
    const { ProfileRecovery } = require("@/features/auth-routing/auth-gate");
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- late import after mocks
    const { useAuth } = require("../auth-provider");
    function Gate() {
      const { state } = useAuth();
      return state.status === "profile-missing" ? <ProfileRecovery reason="missing" /> : null;
    }
    render(
      <AuthProvider>
        <Gate />
      </AuthProvider>
    );

    const retry = await screen.findByRole("button", { name: "Réessayer" });
    expect(mockCalls.profiles).toBe(1);
    fireEvent.press(retry);
    await waitFor(() => expect(mockCalls.profiles).toBe(2));
  });
});
