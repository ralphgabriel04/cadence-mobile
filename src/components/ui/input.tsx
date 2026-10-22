import { useState } from "react";
import { View, TextInput, type TextInputProps } from "react-native";

import { usePalette } from "@/theme/tokens";
import { Text } from "./text";

type InputProps = TextInputProps & {
  label: string;
  error?: string;
};

export function Input({
  label,
  error,
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
      <TextInput
        className={`h-[50px] w-full rounded-input border bg-surface px-3.5 font-sans-medium text-sm text-text ${border} ${className}`}
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
      {error ? <Text variant="error">{error}</Text> : null}
    </View>
  );
}
