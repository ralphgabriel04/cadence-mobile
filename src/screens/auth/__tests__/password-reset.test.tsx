import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { ForgotPasswordScreen } from "../forgot-password-screen";
import { ResetPasswordScreen } from "../reset-password-screen";

const mockResetPassword = jest.fn();
const mockUpdatePassword = jest.fn();
const mockAccept = jest.fn();
const mockSignOut = jest.fn();
const mockReplace = jest.fn();
let mockUrl: string | null = null;
let mockHasSession = false;

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    resetPassword: mockResetPassword,
    updatePassword: mockUpdatePassword,
    acceptRecoveryLink: mockAccept,
    signOut: mockSignOut,
    session: mockHasSession ? { user: { id: "u" } } : null,
  }),
}));
jest.mock("expo-linking", () => ({ useURL: () => mockUrl }));
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
}));

const LINK = "cadence://reset-password#access_token=AAA&refresh_token=BBB&type=recovery";

beforeEach(() => {
  mockUrl = null;
  mockHasSession = false;
  mockResetPassword.mockResolvedValue({ error: null });
  mockUpdatePassword.mockResolvedValue({ error: null });
  mockAccept.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue(undefined);
});

describe("2.3 · ForgotPasswordScreen", () => {
  // Critère 3 : même message que le compte existe ou non.
  it("shows the same non-revealing message whatever the address", async () => {
    const texts: string[] = [];
    for (const email of ["inscrit@cadence.test", "inconnu@cadence.test"]) {
      const view = render(<ForgotPasswordScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("nom@exemple.com"), email);
      fireEvent.press(screen.getByText("Envoyer le lien"));
      await waitFor(() => expect(mockResetPassword).toHaveBeenLastCalledWith(email));
      const node = await screen.findByText(/Si un compte existe/);
      texts.push(String(node.props.children));
      view.unmount();
    }
    expect(texts[0]).toBe(texts[1]);
    expect(texts[0]).not.toMatch(/introuvable|n'existe pas|aucun compte/i);
  });
});

describe("2.3 · ResetPasswordScreen", () => {
  // Critère 2
  it("accepts the recovery link, then saves the new password and signs out", async () => {
    mockUrl = LINK;
    render(<ResetPasswordScreen />);

    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith(LINK));
    fireEvent.changeText(await screen.findByPlaceholderText("Minimum 8 caractères"), "nouveaumdp1");
    fireEvent.changeText(screen.getByPlaceholderText("Retapez votre mot de passe"), "nouveaumdp1");
    fireEvent.press(screen.getByText("Mettre à jour"));

    await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalledWith("nouveaumdp1"));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  // Critère 4
  it("shows an expired-link message and no form for a link already used", async () => {
    mockUrl = "cadence://reset-password#error=access_denied&error_code=otp_expired";
    render(<ResetPasswordScreen />);

    expect(await screen.findByText(/expiré|déjà été utilisé/)).toBeTruthy();
    expect(screen.queryByPlaceholderText("Minimum 8 caractères")).toBeNull();
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("shows the expired message when the server refuses the link", async () => {
    mockUrl = LINK;
    mockAccept.mockResolvedValue({
      error: "Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau.",
    });
    render(<ResetPasswordScreen />);
    expect(await screen.findByText(/expiré|déjà été utilisé/)).toBeTruthy();
    expect(screen.queryByPlaceholderText("Minimum 8 caractères")).toBeNull();
  });

  it("enforces only the 8-character minimum", async () => {
    mockUrl = LINK;
    render(<ResetPasswordScreen />);
    fireEvent.changeText(await screen.findByPlaceholderText("Minimum 8 caractères"), "abc");
    fireEvent.changeText(screen.getByPlaceholderText("Retapez votre mot de passe"), "abc");
    fireEvent.press(screen.getByText("Mettre à jour"));
    expect((await screen.findAllByText(/au moins 8 caractères/)).length).toBeGreaterThan(0);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });
});
