import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { createMemoryStore } from "@/services/local-store";
import { createProfileCache } from "@/services/profile-cache";

import { AuthProvider, useAuth } from "../auth-provider";

// Story 4.1, criterion 4: opening the app without network reaches the home
// screen when this phone already loaded the profile of the same account.

const mockUserId = "aaaaaaaa-0000-4000-8000-000000000001";
const mockSession = {
  access_token: "t",
  refresh_token: "r",
  user: { id: mockUserId, email: "a@cadence.test" },
};
const profile = {
  id: mockUserId,
  email: "a@cadence.test",
  first_name: "Ralph",
  last_name: "Gabriel",
  role: "athlete" as const,
  avatar_url: null,
  onboarding_completed: true,
};
let mockImpl: () => Promise<{ data: unknown; error: unknown }>;
const mockCache = createProfileCache(createMemoryStore());

jest.mock("@/services/profile-cache", () => ({
  ...jest.requireActual("@/services/profile-cache"),
  profileCache: () => mockCache,
}));

jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: mockSession } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () => mockImpl() }) }),
    })),
  },
}));

function Probe() {
  const { state } = useAuth();
  return <Text>{state.status === "ready" ? `ready:${state.profile.first_name}` : state.status}</Text>;
}

const open = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

beforeEach(() => mockCache.erase());

describe("4.1 · opening the app offline", () => {
  it("a loaded profile is kept, then used when the network is gone", async () => {
    mockImpl = async () => ({ data: profile, error: null });
    const online = open();
    await waitFor(() => expect(online.getByText("ready:Ralph")).toBeTruthy());
    online.unmount();

    mockImpl = () => Promise.reject(new Error("Network request failed"));
    const offline = open();
    await waitFor(() => expect(offline.getByText("ready:Ralph")).toBeTruthy());
  });

  it("a fetch error without a PostgREST code counts as the network", async () => {
    mockCache.save(profile);
    mockImpl = async () => ({ data: null, error: { message: "TypeError: Failed to fetch", code: "" } });
    const view = open();
    await waitFor(() => expect(view.getByText("ready:Ralph")).toBeTruthy());
  });

  it("without a copy, the retryable error stays", async () => {
    mockImpl = () => Promise.reject(new Error("Network request failed"));
    const view = open();
    await waitFor(() => expect(view.getByText("error")).toBeTruthy());
  });

  it("another account's copy is never used", async () => {
    mockCache.save({ ...profile, id: "bbbbbbbb-0000-4000-8000-000000000002" });
    mockImpl = () => Promise.reject(new Error("Network request failed"));
    const view = open();
    await waitFor(() => expect(view.getByText("error")).toBeTruthy());
  });

  it("a server error (with a code) is not treated as offline", async () => {
    mockCache.save(profile);
    mockImpl = async () => ({ data: null, error: { message: "permission denied", code: "42501" } });
    const view = open();
    await waitFor(() => expect(view.getByText("error")).toBeTruthy());
  });
});
