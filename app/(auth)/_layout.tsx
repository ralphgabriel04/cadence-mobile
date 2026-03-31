import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function AuthLayout() {
  const { session, profile } = useAuth();

  if (session && profile) {
    if (profile.role === "coach") {
      return <Redirect href="/(coach)" />;
    }
    return <Redirect href="/(athlete)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
