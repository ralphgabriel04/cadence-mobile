import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

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

describe("2.6 (b) · état de l'écran pendant et après la suppression", () => {
  it("re-enables the buttons and shows the error when deleteAccount rejects", async () => {
    mockDeleteAccount.mockRejectedValue(new Error("boom"));
    render(<AthleteSettingsScreen />);
    fireEvent.press(screen.getByText("Supprimer mon compte"));
    fireEvent.press(screen.getByText("Supprimer définitivement"));

    expect(await screen.findByText(/La suppression a échoué/)).toBeTruthy();
    expect(screen.getByText("Annuler")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Supprimer définitivement mon compte" }).props.accessibilityState
    ).toMatchObject({ busy: false });
  });

  it("is busy and not re-sendable while the deletion runs", async () => {
    let done: (v: { error: null }) => void = () => {};
    mockDeleteAccount.mockReturnValue(new Promise((r) => (done = r)));
    render(<AthleteSettingsScreen />);
    fireEvent.press(screen.getByText("Supprimer mon compte"));
    fireEvent.press(screen.getByText("Supprimer définitivement"));

    const button = await screen.findByRole("button", { name: "Supprimer définitivement mon compte" });
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    fireEvent.press(button);
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    await act(async () => done({ error: null }));
  });

  it("announces a failure as an alert", async () => {
    mockDeleteAccount.mockResolvedValue({ error: "La suppression a échoué. Réessaie." });
    render(<AthleteSettingsScreen />);
    fireEvent.press(screen.getByText("Supprimer mon compte"));
    fireEvent.press(screen.getByText("Supprimer définitivement"));
    const message = await screen.findByText("La suppression a échoué. Réessaie.");
    expect(message.props.accessibilityRole).toBe("alert");
  });

  // Contraste : texte ajouté en text-text (17,42:1 clair / 16,91:1 sombre), jamais text-error (3,76:1).
  it("uses the default text colour, not the error red, for what this story adds", async () => {
    mockDeleteAccount.mockResolvedValue({ error: "La suppression a échoué. Réessaie." });
    render(<AthleteSettingsScreen />);
    const row = screen.getByText("Supprimer mon compte");
    expect(String(row.props.className)).not.toMatch(/text-error/);
    fireEvent.press(row);
    fireEvent.press(screen.getByText("Supprimer définitivement"));
    await screen.findByText("La suppression a échoué. Réessaie.");

    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toMatch(/text-text/); // control: class names are visible in this renderer
    const panel = tree.slice(tree.indexOf("Ce qui sera effacé"));
    expect(panel).not.toMatch(/text-error/);
  });
});
