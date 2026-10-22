import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";

/**
 * Progression (design/wireframe/athlete/progression): weekly volume, key-lift
 * curves and recent PRs. Every block needs aggregates the schema does not
 * compute yet, so this is an honest placeholder, not a chart on fake numbers.
 */
export function HistoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <TopBar big title="Progression" />
      <ScrollView contentContainerClassName="gap-2.5 px-5 pb-10 pt-1">
        <SectionLabel>Bientôt</SectionLabel>
        <Card className="gap-2">
          <Text weight="bold" className="text-[15px]">
            Volume, records et courbes de progression
          </Text>
          <View>
            <Text variant="caption" className="text-[13px] leading-5">
              Tes séances complétées sont enregistrées. Les statistiques arrivent quand il y
              aura assez d&apos;historique pour dire quelque chose de vrai.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
