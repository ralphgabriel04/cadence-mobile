import { Redirect, Stack } from "expo-router";

import { AuthSplash } from "@/features/auth-routing/auth-gate";
import { useAuth } from "@/providers/auth-provider";
import { homeRouteFor, isResolving } from "@/providers/auth-state";

/**
 * Keeps signed-in users out of the auth screens.
 *
 * Previously gated on `session && profile`, while its sibling layouts gated on
 * `session` alone. That disagreement was half of the navigation loop: during the
 * window where a session existed but the profile did not, this layout let the
 * user stay on login while the others pushed them out.
 */
export default function AuthLayout() {
  const { state } = useAuth();

  if (isResolving(state)) {
    return <AuthSplash />;
  }

  if (state.status !== "signed-out") {
    const route = homeRouteFor(state);
    // Never redirect to login from here: that is this group, and it would loop.
    if (route && route !== "/(auth)/login") {
      return <Redirect href={route} />;
    }
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
