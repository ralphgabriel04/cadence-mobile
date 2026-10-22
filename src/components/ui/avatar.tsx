import { View } from "react-native";

import { Text } from "./text";

type AvatarProps = {
  initials: string;
  size?: number;
  /** Accent ring, for the identity header of a profile. */
  ring?: boolean;
};

export function initialsOf(first?: string | null, last?: string | null): string {
  const a = first?.trim().charAt(0) ?? "";
  const b = last?.trim().charAt(0) ?? "";
  return (a + b).toUpperCase() || "?";
}

export function Avatar({ initials, size = 40, ring = false }: AvatarProps) {
  return (
    <View
      className={`items-center justify-center bg-accent-dim ${ring ? "border-2 border-accent" : ""}`}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text weight="bold" className="text-accent" style={{ fontSize: Math.round(size * 0.36) }}>
        {initials}
      </Text>
    </View>
  );
}
