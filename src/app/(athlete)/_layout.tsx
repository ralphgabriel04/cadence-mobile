import { Redirect, Tabs } from "expo-router";

import { AuthSplash, ProfileRecovery } from "@/features/auth-routing/auth-gate";
import { useAuth } from "@/providers/auth-provider";
import { isResolving } from "@/providers/auth-state";

/**
 * Athlete group guard.
 *
 * This is also where an authenticated-but-unidentifiable user lands, because
 * `homeRouteFor` sends `profile-missing` and `error` here rather than to login:
 * bouncing a valid session back to the auth group would loop.
 */
export default function AthleteLayout() {
  const { state } = useAuth();

  if (isResolving(state)) {
    return <AuthSplash />;
  }

  if (state.status === "signed-out") {
    return <Redirect href="/(auth)/login" />;
  }

  if (state.status === "profile-missing") {
    return <ProfileRecovery reason="missing" />;
  }

  if (state.status === "error") {
    return <ProfileRecovery reason="error" message={state.message} />;
  }

  // `state.status` is narrowed to "ready" here, so the role is known -- no
  // optional chaining, and no window where an unknown role reads as "athlete".
  if (state.profile.role === "coach") {
    return <Redirect href="/(coach)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#3b82f6",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Aujourd'hui" }} />
      <Tabs.Screen name="history" options={{ title: "Historique" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}
