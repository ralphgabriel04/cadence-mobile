import { ActivityIndicator, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/providers/auth-provider";
import { usePalette } from "@/theme/tokens";

/**
 * Shown while the session or the profile is still being resolved.
 *
 * Every layout renders this instead of redirecting during that window. Without
 * it, routing acted on a half-known state and coaches were sent to the athlete
 * UI before bouncing.
 */
export function AuthSplash() {
  const palette = usePalette();

  return (
    <View
      className="flex-1 items-center justify-center bg-bg"
      accessible
      accessibilityLabel="Chargement du profil"
    >
      <ActivityIndicator size="large" color={palette.accent} />
    </View>
  );
}

/**
 * Shown when the user holds a valid session but the app cannot determine who
 * they are: either the profiles row is absent, or the request failed.
 *
 * These two keep distinct wording. A failed request is transient. A missing
 * profile may be (a slow trigger) or may need attention, so both offer a retry
 * (story 2.4, default answer) and the missing case also points to the team.
 */
export function ProfileRecovery({
  reason,
  message,
}: {
  reason: "missing" | "error";
  message?: string;
}) {
  const { refreshProfile, signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-bg px-8">
      <Text variant="heading" className="text-center">
        {reason === "missing" ? "Ton profil est introuvable" : "Connexion impossible"}
      </Text>

      <Text className="text-center leading-5">
        {reason === "missing"
          ? "Ton compte existe, mais son profil n'a pas été créé. Réessaie dans un instant. Si le problème persiste, déconnecte-toi puis reconnecte-toi, ou écris-nous."
          : "On n'a pas réussi à charger ton profil. Vérifie ta connexion et réessaie."}
      </Text>

      {reason === "error" && message ? (
        <Text variant="caption" className="text-center text-text-muted">
          {message}
        </Text>
      ) : null}

      <Button
        title="Réessayer"
        accessibilityRole="button"
        onPress={refreshProfile}
        className="w-full"
      />

      <Button
        title="Se déconnecter"
        variant="outline"
        onPress={() => void signOut()}
        className="w-full"
      />
    </View>
  );
}
