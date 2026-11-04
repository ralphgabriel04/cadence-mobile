import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";

import { SectionLabel } from "@/components/ui/section-label";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-group";
import { TopBar } from "@/components/ui/top-bar";
import { DeleteAccountPanel } from "@/features/account-deletion/delete-account-panel";
import { useAuth } from "@/providers/auth-provider";

/**
 * Réglages: sub-screen of the profile (pushed, no tab of its own).
 *
 * Reduced version of design/wireframe/athlete/settings: only rows backed by
 * something real are shown. A row that does nothing gets no chevron, so the
 * screen never promises an action it cannot perform. Theme switching is one
 * `colorScheme.set()` call away (nativewind) once a persisted preference exists.
 */
export function AthleteSettingsScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDeletion = async () => {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await deleteAccount();
    setDeleting(false);
    if (error) setDeleteError(error);
  };
  const version = Constants.expoConfig?.version ?? "dev";

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <TopBar title="Réglages" onBack />
      <ScrollView contentContainerClassName="gap-6 px-5 pb-10 pt-1">
        <View className="gap-2.5">
          <SectionLabel>Compte</SectionLabel>
          <SettingsGroup>
            <SettingsRow icon="mail-outline" label="Courriel" value={user?.email ?? "—"} last />
          </SettingsGroup>
        </View>

        <View className="gap-2.5">
          <SectionLabel>Préférences</SectionLabel>
          <SettingsGroup>
            <SettingsRow icon="color-palette-outline" label="Thème" value="Système" />
            <SettingsRow icon="globe-outline" label="Langue" value="Français" last />
          </SettingsGroup>
        </View>

        <View className="gap-2.5">
          <SectionLabel>À propos</SectionLabel>
          <SettingsGroup>
            <SettingsRow icon="information-circle-outline" label="Version" value={version} last />
          </SettingsGroup>
        </View>

        <SettingsGroup>
          <SettingsRow
            icon="log-out-outline"
            label="Se déconnecter"
            danger
            onPress={() => void signOut()}
            last
          />
        </SettingsGroup>

        {confirming ? (
          <DeleteAccountPanel
            busy={deleting}
            error={deleteError}
            onConfirm={() => void confirmDeletion()}
            onCancel={() => {
              setConfirming(false);
              setDeleteError(null);
            }}
          />
        ) : (
          <SettingsGroup>
            <SettingsRow
              icon="trash-outline"
              label="Supprimer mon compte"
              danger
              onPress={() => setConfirming(true)}
              last
            />
          </SettingsGroup>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
