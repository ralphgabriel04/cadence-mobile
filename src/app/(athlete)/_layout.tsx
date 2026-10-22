import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AuthSplash, ProfileRecovery } from "@/features/auth-routing/auth-gate";
import { useAuth } from "@/providers/auth-provider";
import { isResolving } from "@/providers/auth-state";
import { fonts, usePalette } from "@/theme/tokens";

/**
 * Athlete group guard.
 *
 * This is also where an authenticated-but-unidentifiable user lands, because
 * `homeRouteFor` sends `profile-missing` and `error` here rather than to login:
 * bouncing a valid session back to the auth group would loop.
 */
export default function AthleteLayout() {
  const { state } = useAuth();
  const palette = usePalette();

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

  // Tab names and icons follow the athlete NavBar of design/wireframe/cadence-kit.jsx:
  // Accueil / Programme / Progression / Profil.
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
        tabBarLabelStyle: { fontFamily: fonts.sansBold, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "Programme",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      {/*
        The live session is pushed, not a tab: it runs for the duration of a
        workout and is dismissed when it ends. href: null keeps it out of the
        tab bar while leaving the route navigable. Same for settings, a
        sub-screen of the profile.
      */}
      <Tabs.Screen name="session" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen
        name="history"
        options={{
          title: "Progression",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
