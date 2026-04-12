import { View, type ViewProps } from "react-native";

export function Card({ className = "", ...props }: ViewProps) {
  return (
    <View
      className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm ${className}`}
      {...props}
    />
  );
}
