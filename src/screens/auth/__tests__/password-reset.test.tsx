import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { ResetPasswordScreen } from "../reset-password-screen";

const mockUpdatePassword = jest.fn();
const mockAccept = jest.fn();
const mockSignOut = jest.fn();
const mockReplace = jest.fn();
let mockUrl: string | null = null;
let mockStatus = "signed-out";

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    state: { status: mockStatus },
    updatePassword: mockUpdatePassword,
    acceptRecoveryLink: mockAccept,
    signOut: mockSignOut,
  }),
}));
jest.mock("expo-linking", () => ({ useURL: () => mockUrl }));
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
}));

const LINK = "cadence://reset-password#access_token=AAA&refresh_token=BBB&type=recovery";
const LINK_2 = "cadence://reset-password#access_token=CCC&refresh_token=DDD&type=recovery";
const NEW_PASSWORD_FIELD = "Minimum 8 caractères";

beforeEach(() => {
  mockUrl = null;
  mockStatus = "signed-out";
  mockUpdatePassword.mockResolvedValue({ error: null });
  mockAccept.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue({ error: null });
});

describe("2.3 · ResetPasswordScreen", () => {
  // Critère 2
  it("accepts the recovery link, then saves the new password and signs out", async () => {
    mockUrl = LINK;
    render(<ResetPasswordScreen />);

    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith(LINK));
    fireEvent.changeText(await screen.findByPlaceholderText(NEW_PASSWORD_FIELD), "nouveaumdp1");
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
    expect(screen.queryByPlaceholderText(NEW_PASSWORD_FIELD)).toBeNull();
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("shows the provider's refusal and no form", async () => {
    mockUrl = LINK;
    mockAccept.mockResolvedValue({ error: "Ce lien ne vient pas d'une demande faite depuis cet appareil." });
    render(<ResetPasswordScreen />);
    expect(await screen.findByText(/ne vient pas d'une demande/)).toBeTruthy();
    expect(screen.queryByPlaceholderText(NEW_PASSWORD_FIELD)).toBeNull();
  });

  it("enforces only the 8-character minimum", async () => {
    mockUrl = LINK;
    render(<ResetPasswordScreen />);
    fireEvent.changeText(await screen.findByPlaceholderText(NEW_PASSWORD_FIELD), "abc");
    fireEvent.changeText(screen.getByPlaceholderText("Retapez votre mot de passe"), "abc");
    fireEvent.press(screen.getByText("Mettre à jour"));
    expect((await screen.findAllByText(/au moins 8 caractères/)).length).toBeGreaterThan(0);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  // R8
  it("says so when no link ever arrives, instead of waiting forever", async () => {
    jest.useFakeTimers();
    render(<ResetPasswordScreen />);
    expect(screen.getByText("Vérification du lien…")).toBeTruthy();
    await act(async () => void jest.advanceTimersByTime(2000));
    expect(screen.getByText("Aucun lien reçu")).toBeTruthy();
    expect(screen.getByText("Demander un nouveau lien")).toBeTruthy();
    jest.useRealTimers();
  });

  it("shows the form without a URL when a recovery is already in progress", async () => {
    mockStatus = "recovery";
    render(<ResetPasswordScreen />);
    expect(await screen.findByPlaceholderText(NEW_PASSWORD_FIELD)).toBeTruthy();
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("starts over on a new link: back to checking, typed passwords cleared", async () => {
    mockUrl = LINK;
    const view = render(<ResetPasswordScreen />);
    fireEvent.changeText(await screen.findByPlaceholderText(NEW_PASSWORD_FIELD), "premiermdp1");

    let release: (v: { error: null }) => void = () => {};
    mockAccept.mockReturnValueOnce(new Promise((r) => (release = r)));
    mockUrl = LINK_2;
    view.rerender(<ResetPasswordScreen />);

    expect(await screen.findByText("Vérification du lien…")).toBeTruthy(); // old "ready" is gone
    expect(screen.queryByPlaceholderText(NEW_PASSWORD_FIELD)).toBeNull();
    await act(async () => release({ error: null }));
    expect((await screen.findByPlaceholderText(NEW_PASSWORD_FIELD)).props.value).toBe("");
  });

  it("lets the user abandon: signs out of the temporary session", async () => {
    mockUrl = LINK;
    render(<ResetPasswordScreen />);
    fireEvent.press(await screen.findByText("Annuler"));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });
});
