import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, useAuth } from "../auth-provider";

const mockUserId = "aaaaaaaa-0000-4000-8000-000000000001";
const mockSession = {
  access_token: "t",
  refresh_token: "r",
  user: { id: mockUserId, email: "a@cadence.test" },
};
let mockImpl: () => Promise<{ data: unknown; error: unknown }>;
let mockCalls = 0;

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
            mockCalls += 1;
            return mockImpl();
          },
        }),
      }),
    })),
  },
}));

function Probe() {
  const { state } = useAuth();
  return <Text>{state.status}</Text>;
}

beforeEach(() => {
  mockCalls = 0;
});

describe("2.4 · profile request outcomes (real AuthProvider, Supabase mocked)", () => {
  it("a rejected request (network down) ends in the retryable error state", async () => {
    mockImpl = () => Promise.reject(new Error("Network request failed"));
    const view = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(view.getByText("error")).toBeTruthy());
    expect(mockCalls).toBe(1);
  });

  it("a missing row ends in profile-missing, a loaded row in ready", async () => {
    mockImpl = async () => ({ data: null, error: null });
    const first = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(first.getByText("profile-missing")).toBeTruthy());
    first.unmount();

    mockImpl = async () => ({
      data: {
        id: mockUserId,
        email: "a@cadence.test",
        first_name: "A",
        last_name: "T",
        role: "athlete",
        avatar_url: null,
        onboarding_completed: false,
      },
      error: null,
    });
    const second = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(second.getByText("ready")).toBeTruthy());
  });
});
