import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";

export default function CoachProfileScreen() {
  const { profile, user, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="flex-1 px-6 py-8">
        <Text variant="heading" className="mb-6">
          Profil
        </Text>

        <Card className="mb-6">
          {profile?.first_name || profile?.last_name ? (
            <Text variant="body" className="font-semibold mb-1">
              {profile.first_name} {profile.last_name}
            </Text>
          ) : null}
          <Text variant="caption">{user?.email}</Text>
          <View className={`mt-3 self-start rounded-full px-3 py-1 ${
            profile?.role === "coach"
              ? "bg-blue-100 dark:bg-blue-900"
              : "bg-green-100 dark:bg-green-900"
          }`}>
            <Text className={`text-sm font-medium ${
              profile?.role === "coach"
                ? "text-blue-700 dark:text-blue-300"
                : "text-green-700 dark:text-green-300"
            }`}>
              {profile?.role === "coach" ? "Coach" : "Athlète"}
            </Text>
          </View>
        </Card>

        <Button
          title="Se déconnecter"
          variant="danger"
          onPress={signOut}
        />
      </View>
    </SafeAreaView>
  );
}
