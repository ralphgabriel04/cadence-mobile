import type { TextProps } from "react-native";

import { Text } from "./text";

/** 11px uppercase section header, muted by default. Pass `text-accent` to highlight. */
export function SectionLabel({ className = "", ...props }: TextProps) {
  return (
    <Text
      weight="bold"
      className={`text-[11px] uppercase tracking-[1px] text-text-muted ${className}`}
      {...props}
    />
  );
}
