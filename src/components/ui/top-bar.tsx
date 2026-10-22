import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { usePalette } from "@/theme/tokens";
import { Text } from "./text";

type TopBarProps = {
  title: string;
  /** Show a back chevron; `true` calls router.back(). */
  onBack?: boolean | (() => void);
  right?: ReactNode;
  /** 22px page title (tab roots) instead of the 18px sub-screen title. */
  big?: boolean;
};

export function TopBar({ title, onBack, right, big = false }: TopBarProps) {
  const palette = usePalette();
  const back = onBack === true ? () => router.back() : onBack || undefined;

  return (
    <View className="h-14 flex-row items-center gap-2 px-5">
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          onPress={back}
          className="-ml-2 h-9 w-9 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </Pressable>
      ) : null}
      <Text
        variant={big ? "heading" : "body"}
        weight="bold"
        className={`flex-1 ${big ? "" : "text-lg tracking-[-0.3px]"}`}
        numberOfLines={1}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}
