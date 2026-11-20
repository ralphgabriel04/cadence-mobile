import type { TextProps } from "react-native";

import { hasColourClass, Text } from "./text";

/** 11px uppercase section header, muted by default. Pass `text-accent` to highlight. */
export function SectionLabel({ className = "", ...props }: TextProps) {
  return (
    <Text
      weight="bold"
      // The muted default only when the caller sets no colour (text-accent would lose on the web).
      className={`text-[11px] uppercase tracking-[1px] ${hasColourClass(className) ? "" : "text-text-muted"} ${className}`}
      {...props}
    />
  );
}
