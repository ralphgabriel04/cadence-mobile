import type { ComponentProps, ReactNode } from "react";
import { Pressable, View, type ViewProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { usePalette } from "@/theme/tokens";
import { Text } from "./text";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/** Grouped list container: rows separated by hairlines inside one card. */
export function SettingsGroup({ className = "", ...props }: ViewProps) {
  return (
    <View
      className={`overflow-hidden rounded-card border border-border bg-surface ${className}`}
      {...props}
    />
  );
}

type SettingsRowProps = {
  label: string;
  icon?: IconName;
  /** Secondary text on the right, e.g. the current value. */
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  /** Skip the bottom hairline on the last row of a group. */
  last?: boolean;
  /** Custom right-side content; replaces the chevron. */
  trailing?: ReactNode;
};

export function SettingsRow({
  label,
  icon,
  value,
  onPress,
  danger = false,
  last = false,
  trailing,
}: SettingsRowProps) {
  const palette = usePalette();

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      className={`min-h-[52px] flex-row items-center gap-3 px-4 py-2 active:bg-surface2 ${last ? "" : "border-b border-border"}`}
    >
      {icon ? <Ionicons name={icon} size={20} color={danger ? palette.error : palette.textSub} /> : null}
      <Text weight="semibold" className={`flex-1 ${danger ? "text-error" : ""}`}>
        {label}
      </Text>
      {value ? <Text variant="caption">{value}</Text> : null}
      {trailing ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
        ) : null)}
    </Pressable>
  );
}
