import { useState } from "react";
import { Pressable, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { usePalette } from "@/theme/tokens";
import { Input } from "./input";

type PasswordInputProps = Omit<TextInputProps, "secureTextEntry"> & {
  label: string;
  error?: string;
};

/**
 * Password field with an eye button to show or hide what was typed, so the user
 * can check a new password before saving it. Hidden by default; the button says
 * what it will do for screen readers.
 */
export function PasswordInput(props: PasswordInputProps) {
  const palette = usePalette();
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      accessory={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          hitSlop={8}
          onPress={() => setVisible((v) => !v)}
          className="h-[50px] w-11 items-center justify-center"
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={palette.textSub}
          />
        </Pressable>
      }
    />
  );
}
