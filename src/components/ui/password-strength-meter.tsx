import { View } from "react-native";

import { passwordStrength, type StrengthLevel } from "@/features/auth-routing/password-strength";
import { Text } from "./text";

function barColour(level: StrengthLevel): string {
  if (level <= 1) return "bg-error";
  if (level === 2) return "bg-warning";
  return "bg-success";
}

/**
 * Four-segment bar with the level in words ("Sécurité : Moyen") and one tip.
 * The words carry the meaning, the colour only repeats it (WCAG 1.4.1).
 * Nothing is shown before the first character.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { level, label, hint } = passwordStrength(password);
  const filled = Math.max(level, 1);

  return (
    <View
      className="w-full gap-1.5"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Sécurité du mot de passe : ${label}${hint ? `. ${hint}` : ""}`}
    >
      <View className="flex-row gap-1">
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            testID={i <= filled ? "strength-segment-on" : "strength-segment-off"}
            className={`h-1 flex-1 rounded-full ${i <= filled ? barColour(level) : "bg-border"}`}
          />
        ))}
      </View>
      <Text variant="caption" className="text-text-sub">
        Sécurité :{" "}
        <Text variant="caption" weight="bold">
          {label}
        </Text>
        {hint ? ` · ${hint}` : ""}
      </Text>
    </View>
  );
}
