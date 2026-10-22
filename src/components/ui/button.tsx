import type { ReactNode } from "react";
import {
  TouchableOpacity,
  ActivityIndicator,
  type TouchableOpacityProps,
} from "react-native";

import { usePalette } from "@/theme/tokens";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type ButtonProps = TouchableOpacityProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  /** Rendered before the title, e.g. an Ionicons element. */
  icon?: ReactNode;
};

const variantStyles: Record<Variant, string> = {
  primary: "bg-btn-primary-bg",
  secondary: "bg-surface2 border border-border",
  outline: "border border-border",
  ghost: "",
  danger: "",
};

const textStyles: Record<Variant, string> = {
  primary: "text-btn-primary-text",
  secondary: "text-text",
  outline: "text-text",
  ghost: "text-accent",
  danger: "text-error",
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  disabled,
  icon,
  className = "",
  ...props
}: ButtonProps) {
  const palette = usePalette();
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      // eslint-disable-next-line security/detect-object-injection -- variant is a typed enum, not user input
      className={`h-[52px] flex-row items-center justify-center gap-2 rounded-pill px-6 ${variantStyles[variant]} ${isDisabled ? "opacity-50" : ""} ${className}`}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? palette.btnPrimaryText : palette.accent}
        />
      ) : (
        <>
          {icon}
          {/* eslint-disable-next-line security/detect-object-injection -- variant is a typed enum, not user input */}
          <Text weight="bold" className={`text-[15px] ${textStyles[variant]}`}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
