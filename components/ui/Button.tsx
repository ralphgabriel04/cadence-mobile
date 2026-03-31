import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
} from "react-native";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type ButtonProps = TouchableOpacityProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
};

const variantStyles: Record<Variant, string> = {
  primary: "bg-blue-600 dark:bg-blue-500",
  secondary: "bg-gray-200 dark:bg-gray-700",
  outline: "border border-gray-300 dark:border-gray-600",
  ghost: "",
  danger: "bg-red-600 dark:bg-red-500",
};

const textStyles: Record<Variant, string> = {
  primary: "text-white font-semibold",
  secondary: "text-gray-900 dark:text-white font-semibold",
  outline: "text-gray-900 dark:text-white font-semibold",
  ghost: "text-blue-600 dark:text-blue-400",
  danger: "text-white font-semibold",
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`rounded-xl px-6 py-4 items-center justify-center ${variantStyles[variant]} ${isDisabled ? "opacity-50" : ""} ${className}`}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "danger" ? "#fff" : "#3b82f6"}
        />
      ) : (
        <Text className={`text-base ${textStyles[variant]}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
