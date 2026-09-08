import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Avatar, initialsOf } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { SectionLabel } from "@/components/ui/section-label";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-group";
import { Text } from "@/components/ui/text";
import { TopBar } from "@/components/ui/top-bar";
import { useAuth } from "@/providers/auth-provider";
import { usePalette } from "@/theme/tokens";

const SETTINGS_ROUTE = "/(athlete)/settings";

/**
 * Profil: identity view (design/wireframe/shared/profil), distinct from Réglages.
 * The stats band and the linked-coach card of the wireframe need data the
 * schema does not serve yet (cm#31, coach linking) and are left out rather than
 * faked.
 */
export function AthleteProfileScreen() {
  const { profile, user, signOut } = useAuth();
  const palette = usePalette();

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  const openSettings = () => router.push(SETTINGS_ROUTE);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <TopBar
        big
        title="Profil"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Réglages"
            hitSlop={8}
            onPress={openSettings}
            className="h-9 w-9 items-center justify-center"
          >
            <Ionicons name="settings-outline" size={22} color={palette.textSub} />
          </Pressable>
        }
      />
      <ScrollView contentContainerClassName="gap-4 px-5 pb-10 pt-1">
        <View className="items-center gap-3 pt-1.5">
          <Avatar initials={initialsOf(profile?.first_name, profile?.last_name)} size={84} ring />
          <View className="items-center gap-2">
            {name ? <Text variant="heading">{name}</Text> : null}
            <Pill variant="accent" label={profile?.role === "coach" ? "Coach" : "Athlète"} />
          </View>
        </View>

        <View className="gap-2.5">
          <SectionLabel>Infos personnelles</SectionLabel>
          <SettingsGroup>
            <SettingsRow label="Nom" value={name || "—"} />
            <SettingsRow label="Courriel" value={user?.email ?? "—"} last />
          </SettingsGroup>
        </View>

        <SettingsGroup>
          <SettingsRow icon="settings-outline" label="Réglages" onPress={openSettings} last />
        </SettingsGroup>

        <Button title="Se déconnecter" variant="outline" onPress={() => void signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}
