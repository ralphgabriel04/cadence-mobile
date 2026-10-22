import { Redirect, Stack } from "expo-router";

import { AuthSplash, ProfileRecovery } from "@/features/auth-routing/auth-gate";
import { useAuth } from "@/providers/auth-provider";
import { isResolving } from "@/providers/auth-state";

/**
 * Coach group guard.
 *
 * Renders a Stack rather than Tabs: the 2026 release has no coach features, so
 * the group holds a single reachable screen (the 2027 notice, in index.tsx). The
 * dashboard, programs and athletes routes stay on disk for the 2027 work but are
 * not navigable, since nothing links to them.
 */
export default function CoachLayout() {
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

  if (state.profile.role !== "coach") {
    return <Redirect href="/(athlete)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
