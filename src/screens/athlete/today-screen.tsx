import { View } from "react-native";
import { Text } from "@/components/ui/text";

export function AthleteTodayScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
      <Text variant="heading">Aujourd{"'"}hui</Text>
      <Text variant="caption" className="mt-2">
        Placeholder — Sprint 2
      </Text>
    </View>
  );
}
