import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/providers/auth-provider";

/**
 * Landing screen for accounts whose role is `coach`.
 *
 * The 2026 release is an autonomous-athlete product; everything coach-facing is
 * deferred to 2027. A coach account is therefore routed here rather than to a
 * coach dashboard that would load, render tabs, and show nothing -- which reads
 * as a broken app rather than as a deliberate scope decision.
 */
export function CoachNoticeScreen() {
  const { profile, signOut } = useAuth();

  return (
    <ScrollView contentContainerClassName="flex-1 justify-center gap-5 px-8 py-12" className="bg-bg">
      <View className="gap-2">
        <SectionLabel className="text-accent">Espace coach</SectionLabel>
        <Text variant="heading">
          {profile ? `Bonjour ${profile.first_name},` : "Bonjour,"} l&apos;espace coach arrive en
          2027
        </Text>
      </View>

      <Text className="leading-6 text-text-sub">
        Cadence sort d&apos;abord pour les athlètes qui s&apos;entraînent seuls. Créer des
        programmes, suivre tes athlètes et leur écrire, c&apos;est prévu, mais pas dans cette
        version.
      </Text>

      <Text className="leading-6 text-text-sub">
        Ton compte est bien enregistré. On te préviendra dès que l&apos;espace coach ouvre.
      </Text>

      <Text variant="caption" className="leading-5 text-text-muted">
        Tu voulais un compte athlète ? Le rôle se choisit à l&apos;inscription et ne peut pas être
        changé ensuite. Écris-nous et on s&apos;en occupe.
      </Text>

      <Button title="Se déconnecter" variant="outline" onPress={() => void signOut()} />
    </ScrollView>
  );
}
