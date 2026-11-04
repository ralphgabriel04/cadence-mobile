import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { RegisterScreen } from "../register-screen";

const mockSignUp = jest.fn();
jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}));

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
}));

const VALID_PASSWORD = "motdepasse"; // 10 chars, no uppercase, no digit: only length counts

function fill(label: string, value: string) {
  fireEvent.changeText(screen.getByPlaceholderText(label), value);
}

function fillValid(overrides: { email?: string; password?: string } = {}) {
  fill("Prénom", "Alex");
  fill("Nom", "Test");
  fill("nom@exemple.com", overrides.email ?? "alex@cadence.test");
  fill("Minimum 8 caractères", overrides.password ?? VALID_PASSWORD);
  fill("Retapez votre mot de passe", overrides.password ?? VALID_PASSWORD);
}

beforeEach(() => {
  mockSignUp.mockResolvedValue({ error: null });
});

describe("2.1 · RegisterScreen", () => {
  // Critère 1
  it("creates the account with a valid email and a password of 8+ characters", async () => {
    render(<RegisterScreen />);
    fillValid({ password: "abcdefgh" });
    fireEvent.press(screen.getByText("Créer mon compte"));

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alex@cadence.test", password: "abcdefgh" })
    );
    expect(await screen.findByText("Vérifiez votre courriel")).toBeTruthy();
  });

  // Critère 2
  it("shows what to fix under the email field for « nom@ »", () => {
    render(<RegisterScreen />);
    fillValid({ email: "nom@" });
    fireEvent.press(screen.getByText("Créer mon compte"));

    expect(screen.getByText(/sous la forme nom@exemple\.com/)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  // Critère 3
  it("says the minimum is 8 for a 5-character password, under the field", () => {
    render(<RegisterScreen />);
    fillValid({ password: "abcde" });
    fireEvent.press(screen.getByText("Créer mon compte"));

    expect(screen.getByText("Le mot de passe doit contenir au moins 8 caractères")).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  // Critère 4 (côté app : le rôle choisi part avec l'inscription ; côté base : trigger handle_new_user)
  it.each([
    ["Coach", "coach"],
    ["Athlète", "athlete"],
  ])("sends the chosen role (%s) with the sign-up", async (label, role) => {
    render(<RegisterScreen />);
    fillValid();
    fireEvent.press(screen.getByText(label));
    fireEvent.press(screen.getByText("Créer mon compte"));

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({ role }));
  });

  // Critère 5
  it("masks the email on the verification screen", async () => {
    render(<RegisterScreen />);
    fillValid({ email: "romain@exemple.com" });
    fireEvent.press(screen.getByText("Créer mon compte"));

    expect(await screen.findByText(/ro\*\*in@exemple\.com/)).toBeTruthy();
    expect(screen.queryByText(/romain@exemple\.com/)).toBeNull();
  });

  it("never prints the password", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    render(<RegisterScreen />);
    fillValid({ password: "secretsecret" });
    fireEvent.press(screen.getByText("Créer mon compte"));
    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secretsecret");
    spy.mockRestore();
  });
});
