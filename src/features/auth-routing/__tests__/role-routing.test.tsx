import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { ActivityIndicator } from "react-native";

import AthleteLayout from "@/app/(athlete)/_layout";
import CoachLayout from "@/app/(coach)/_layout";
import CoachHomeRoute from "@/app/(coach)/index";
import Index from "@/app/index";
import type { AuthState } from "@/providers/auth-state";

import { athleteReady, coachReady, noProfile, slowProfile } from "../test-accounts.fixtures";

let mockState: AuthState;
const mockRefresh = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    state: mockState,
    profile: mockState.status === "ready" ? mockState.profile : null,
    refreshProfile: mockRefresh,
    signOut: mockSignOut,
  }),
}));

/* eslint-disable react/display-name -- throwaway test doubles */
jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- factory must be synchronous
  const { Text } = require("react-native");
  const Tabs = (_props: { children?: unknown }) => <Text>TABS-ATHLETE</Text>;
  Tabs.Screen = () => null;
  const Stack = () => <Text>STACK-COACH</Text>;
  Stack.Screen = () => null;
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`REDIRECT:${href}`}</Text>,
    Tabs,
    Stack,
  };
});

/* eslint-enable react/display-name */
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

function show(ui: ReactElement, state: AuthState) {
  mockState = state;
  return render(ui);
}

describe("2.4 · routing by role", () => {
  // Critère 1
  it("sends a signed-in athlete to the athlete space (Aujourd'hui tabs)", () => {
    show(<Index />, athleteReady());
    expect(screen.getByText("REDIRECT:/(athlete)")).toBeTruthy();
  });

  it("renders the athlete tabs for an athlete and never redirects them", () => {
    show(<AthleteLayout />, athleteReady());
    expect(screen.getByText("TABS-ATHLETE")).toBeTruthy();
    expect(screen.queryByText(/REDIRECT/)).toBeNull();
  });

  // Critère 2
  it("sends a coach to the coach notice and shows « arrive bientôt »", () => {
    show(<Index />, coachReady());
    expect(screen.getByText("REDIRECT:/(coach)")).toBeTruthy();
  });

  it("bounces a coach out of the athlete space", () => {
    show(<AthleteLayout />, coachReady());
    expect(screen.getByText("REDIRECT:/(coach)")).toBeTruthy();
  });

  it("the coach notice says the coach space is coming soon", () => {
    show(<CoachHomeRoute />, coachReady());
    expect(screen.getByText(/l'espace coach arrive bientôt/i)).toBeTruthy();
  });

  it("keeps a coach in the coach group", () => {
    show(<CoachLayout />, coachReady());
    expect(screen.getByText("STACK-COACH")).toBeTruthy();
  });

  // Critère 3
  it.each([
    ["index", <Index key="i" />],
    ["athlete layout", <AthleteLayout key="a" />],
    ["coach layout", <CoachLayout key="c" />],
  ])("shows a loading indicator, not a redirect, while the profile loads (%s)", (_n, ui) => {
    const view = show(ui, slowProfile());
    expect(screen.queryByText(/REDIRECT/)).toBeNull();
    expect(screen.queryByText(/TABS|STACK/)).toBeNull();
    // ActivityIndicator is the splash's only child.
    expect(view.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  // Critère 4
  it("offers a retry when the profile is not found, and a way out", () => {
    show(<AthleteLayout />, noProfile());
    expect(screen.getByText("Ton profil est introuvable")).toBeTruthy();
    fireEvent.press(screen.getByText("Réessayer"));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/écris-nous/i)).toBeTruthy();
    fireEvent.press(screen.getByText("Se déconnecter"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("offers a retry when the profile request fails", () => {
    const failed = { ...noProfile(), status: "error", message: "network" } as AuthState;
    show(<CoachLayout />, failed);
    fireEvent.press(screen.getByText("Réessayer"));
    expect(mockRefresh).toHaveBeenCalled();
  });
});
