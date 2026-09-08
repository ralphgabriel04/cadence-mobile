import { View, type ViewProps } from "react-native";

import { Text } from "./text";

type Variant = "default" | "active" | "accent" | "warning";

type PillProps = ViewProps & {
  label: string;
  variant?: Variant;
};

const containerStyles: Record<Variant, string> = {
  default: "bg-pill-bg",
  active: "bg-accent",
  accent: "bg-accent-dim",
  warning: "bg-pill-bg",
};

const textStyles: Record<Variant, string> = {
  default: "text-pill-text",
  active: "text-btn-primary-text",
  accent: "text-accent",
  warning: "text-warning",
};

export function Pill({ label, variant = "default", className = "", ...props }: PillProps) {
  return (
    <View
      // eslint-disable-next-line security/detect-object-injection -- variant is a typed enum, not user input
      className={`h-[26px] items-center justify-center rounded-pill px-3 ${containerStyles[variant]} ${className}`}
      {...props}
    >
      {/* eslint-disable-next-line security/detect-object-injection -- variant is a typed enum, not user input */}
      <Text weight="bold" className={`text-xs ${textStyles[variant]}`}>
        {label}
      </Text>
    </View>
  );
}
