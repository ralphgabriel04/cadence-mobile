import { useState, type ReactNode } from "react";
import { View, TextInput, type TextInputProps } from "react-native";

import { usePalette } from "@/theme/tokens";
import { Text } from "./text";

type InputProps = TextInputProps & {
  label: string;
  error?: string;
  /** Element shown inside the field on the right (the eye of a password field). */
  accessory?: ReactNode;
};

export function Input({
  label,
  error,
  accessory,
  className = "",
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);

  const border = error ? "border-error" : focused ? "border-accent" : "border-border";

  return (
    <View className="w-full gap-1.5">
      <Text weight="bold" className="text-[10px] uppercase tracking-[0.8px] text-text-sub">
        {label}
      </Text>
      <View className="relative w-full justify-center">
        <TextInput
          className={`h-[50px] w-full rounded-input border bg-surface px-3.5 font-sans-medium text-sm text-text ${accessory ? "pr-12" : ""} ${border} ${className}`}
          placeholderTextColor={palette.textMuted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {accessory ? <View className="absolute right-0">{accessory}</View> : null}
      </View>
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}
