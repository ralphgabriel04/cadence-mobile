import { fireEvent, render, screen } from "@testing-library/react-native";

import { AthleteSettingsScreen } from "../settings-screen";

const mockSignOut = jest.fn();
jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { email: "felix@exemple.com" },
    profile: null,
    signOut: mockSignOut,
  }),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

describe("AthleteSettingsScreen", () => {
  it("shows the account email and signs out", () => {
    render(<AthleteSettingsScreen />);

    expect(screen.getByText("felix@exemple.com")).toBeTruthy();

    fireEvent.press(screen.getByText("Se déconnecter"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
