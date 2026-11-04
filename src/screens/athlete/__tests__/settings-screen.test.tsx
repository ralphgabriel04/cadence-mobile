import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { AthleteSettingsScreen } from "../settings-screen";

const mockSignOut = jest.fn();
const mockDeleteAccount = jest.fn();
jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { email: "felix@exemple.com" },
    profile: null,
    signOut: mockSignOut,
    deleteAccount: mockDeleteAccount,
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

describe("2.6 (b) · Supprimer mon compte", () => {
  beforeEach(() => mockDeleteAccount.mockResolvedValue({ error: null }));

  // Critère 1
  it("asks for confirmation and explains what will be erased", () => {
    render(<AthleteSettingsScreen />);
    fireEvent.press(screen.getByText("Supprimer mon compte"));

    expect(screen.getByText(/définitivement/i)).toBeTruthy();
    expect(screen.getByText(/programmes/i)).toBeTruthy();
    expect(screen.getByText(/séances/i)).toBeTruthy();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  // Critère 5
  it("leaves the account intact when I cancel", () => {
    render(<AthleteSettingsScreen />);
    fireEvent.press(screen.getByText("Supprimer mon compte"));
    fireEvent.press(screen.getByText("Annuler"));

    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(screen.queryByText("Supprimer définitivement")).toBeNull();
    expect(screen.getByText("felix@exemple.com")).toBeTruthy();
  });

  // Critère 2 (côté app : l'appel part, puis la session est fermée par le fournisseur)
  it("deletes only after the explicit confirmation", async () => {
    render(<AthleteSettingsScreen />);
    fireEvent.press(screen.getByText("Supprimer mon compte"));
    fireEvent.press(screen.getByText("Supprimer définitivement"));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
  });

  it("keeps the confirmation open and shows a message when the deletion fails", async () => {
    mockDeleteAccount.mockResolvedValue({ error: "La suppression a échoué. Réessaie." });
    render(<AthleteSettingsScreen />);
    fireEvent.press(screen.getByText("Supprimer mon compte"));
    fireEvent.press(screen.getByText("Supprimer définitivement"));

    expect(await screen.findByText("La suppression a échoué. Réessaie.")).toBeTruthy();
    expect(screen.getByText("Annuler")).toBeTruthy();
  });
});
