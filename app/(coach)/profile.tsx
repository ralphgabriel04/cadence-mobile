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
          <Text variant="body" className="font-semibold mb-1">
            {profile?.first_name} {profile?.last_name}
          </Text>
          <Text variant="caption">{user?.email}</Text>
          <View className="mt-3 self-start rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1">
            <Text className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              Coach
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
