import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { ActivityIndicator, View } from "react-native";

export default function AthleteLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (profile?.role === "coach") {
    return <Redirect href="/(coach)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#3b82f6",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Aujourd'hui" }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "Historique" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil" }}
      />
    </Tabs>
  );
}
