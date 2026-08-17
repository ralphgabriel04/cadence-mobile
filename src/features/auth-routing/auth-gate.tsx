import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useAuth } from "@/providers/auth-provider";

/**
 * Shown while the session or the profile is still being resolved.
 *
 * Every layout renders this instead of redirecting during that window. Without
 * it, routing acted on a half-known state and coaches were sent to the athlete
 * UI before bouncing.
 *
 * Local to this feature on purpose: the shared design-system primitives in
 * src/components/ui/ belong to the design track and are not modified here.
 */
export function AuthSplash() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );
}

/**
 * Shown when the user holds a valid session but the app cannot determine who
 * they are: either the profiles row is absent, or the request failed.
 *
 * These two are deliberately not merged. A failed request is transient and
 * retrying is the right action. A missing profile is not transient -- the
 * account needs attention -- and offering "retry" there would spin forever.
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
    <View className="flex-1 items-center justify-center gap-4 bg-white px-8 dark:bg-gray-900">
      <Text className="text-center text-xl font-bold text-gray-900 dark:text-white">
        {reason === "missing" ? "Ton profil est introuvable" : "Connexion impossible"}
      </Text>

      <Text className="text-center text-base text-gray-600 dark:text-gray-300">
        {reason === "missing"
          ? "Ton compte existe, mais son profil n'a pas été créé. Déconnecte-toi puis reconnecte-toi. Si le problème persiste, écris-nous."
          : "On n'a pas réussi à charger ton profil. Vérifie ta connexion et réessaie."}
      </Text>

      {reason === "error" && message ? (
        <Text className="text-center text-sm text-gray-400 dark:text-gray-500">{message}</Text>
      ) : null}

      {reason === "error" ? (
        <Pressable
          accessibilityRole="button"
          onPress={refreshProfile}
          className="w-full rounded-xl bg-blue-500 px-6 py-4 active:opacity-80"
        >
          <Text className="text-center text-base font-semibold text-white">Réessayer</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        className="w-full rounded-xl border border-gray-300 px-6 py-4 active:opacity-80 dark:border-gray-700"
      >
        <Text className="text-center text-base font-semibold text-gray-900 dark:text-white">
          Se déconnecter
        </Text>
      </Pressable>
    </View>
  );
}
