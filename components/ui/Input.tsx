import { View, TextInput, Text, type TextInputProps } from "react-native";

type InputProps = TextInputProps & {
  label: string;
  error?: string;
};

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <View className="w-full">
      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </Text>
      <TextInput
        className={`w-full rounded-xl border px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-800 ${
          error
            ? "border-red-500"
            : "border-gray-300 dark:border-gray-600"
        } ${className}`}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error ? (
        <Text className="text-sm text-red-500 mt-1">{error}</Text>
      ) : null}
    </View>
  );
}
