import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { ActivityIndicator, View } from "react-native";

export default function CoachLayout() {
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

  if (profile?.role !== "coach") {
    return <Redirect href="/(athlete)" />;
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
        options={{ title: "Accueil" }}
      />
      <Tabs.Screen
        name="programs"
        options={{ title: "Programmes" }}
      />
      <Tabs.Screen
        name="athletes"
        options={{ title: "Athlètes" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil" }}
      />
    </Tabs>
  );
}
