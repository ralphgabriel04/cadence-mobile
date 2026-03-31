import { Text as RNText, type TextProps as RNTextProps } from "react-native";

type Variant = "heading" | "body" | "caption" | "error";

type TextProps = RNTextProps & {
  variant?: Variant;
};

const variantStyles: Record<Variant, string> = {
  heading: "text-2xl font-bold text-gray-900 dark:text-white",
  body: "text-base text-gray-700 dark:text-gray-300",
  caption: "text-sm text-gray-500 dark:text-gray-400",
  error: "text-sm text-red-500",
};

export function Text({ variant = "body", className = "", ...props }: TextProps) {
  return (
    <RNText className={`${variantStyles[variant]} ${className}`} {...props} />
  );
}
