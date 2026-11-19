import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { ForgotPasswordScreen } from "../forgot-password-screen";

const mockResetPassword = jest.fn();

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ resetPassword: mockResetPassword }),
}));
jest.mock("expo-router", () => ({ Link: ({ children }: { children: unknown }) => children }));

beforeEach(() => mockResetPassword.mockResolvedValue({ error: null }));

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

  // Contraste : le sens est porté par les mots, avec la couleur de texte par défaut.
  it("does not rely on the success colour for the confirmation text", async () => {
    render(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("nom@exemple.com"), "a@cadence.test");
    fireEvent.press(screen.getByText("Envoyer le lien"));
    const node = await screen.findByText(/Si un compte existe/);
    const cls = String(node.props.className ?? "");
    expect(cls).toMatch(/text-center/); // control: className is readable in this renderer
    expect(cls).not.toMatch(/text-success/);
  });
});
