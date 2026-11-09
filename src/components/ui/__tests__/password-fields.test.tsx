import { fireEvent, render, screen } from "@testing-library/react-native";

import { PasswordInput } from "../password-input";
import { PasswordStrengthMeter } from "../password-strength-meter";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

describe("PasswordInput · eye button", () => {
  it("hides the password by default, shows it on the eye, hides it again", () => {
    render(<PasswordInput label="Mot de passe" placeholder="pw" value="Secret123" />);
    const field = () => screen.getByPlaceholderText("pw");

    expect(field().props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByLabelText("Afficher le mot de passe"));
    expect(field().props.secureTextEntry).toBe(false);
    fireEvent.press(screen.getByLabelText("Masquer le mot de passe"));
    expect(field().props.secureTextEntry).toBe(true);
  });

  it("keeps the field's own props and error", () => {
    const onChange = jest.fn();
    render(
      <PasswordInput
        label="Mot de passe"
        placeholder="pw"
        onChangeText={onChange}
        error="Trop court"
      />
    );
    fireEvent.changeText(screen.getByPlaceholderText("pw"), "abc");
    expect(onChange).toHaveBeenCalledWith("abc");
    expect(screen.getByText("Trop court")).toBeTruthy();
  });
});

describe("PasswordStrengthMeter", () => {
  it("shows nothing before the first character", () => {
    render(<PasswordStrengthMeter password="" />);
    expect(screen.queryByText(/Sécurité/)).toBeNull();
  });

  it("says the level in words and fills as many segments", () => {
    const { rerender } = render(<PasswordStrengthMeter password="Cadence2026" />);
    expect(screen.getByText("Faible")).toBeTruthy();
    expect(screen.getAllByTestId("strength-segment-on")).toHaveLength(1);

    rerender(<PasswordStrengthMeter password="Bleu7vert-rouge" />);
    expect(screen.getByText("Très fort")).toBeTruthy();
    expect(screen.getAllByTestId("strength-segment-on")).toHaveLength(4);
  });

  it("is announced to screen readers with the level and the tip", () => {
    render(<PasswordStrengthMeter password="bleuvert" />);
    expect(
      screen.getByLabelText("Sécurité du mot de passe : Faible. Allonge-le à 12 caractères ou plus")
    ).toBeTruthy();
  });
});
