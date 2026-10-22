import { Redirect } from "expo-router";

import { AuthSplash } from "@/features/auth-routing/auth-gate";
import { useAuth } from "@/providers/auth-provider";
import { homeRouteFor } from "@/providers/auth-state";

/**
 * Routing entry point. Holds no policy of its own: `homeRouteFor` is the single
 * place that decides where an authenticated user belongs, so this file and every
 * group layout cannot disagree the way they previously did.
 *
 * A null route means the answer is not known yet -- render the splash rather
 * than guessing.
 */
export default function Index() {
  const { state } = useAuth();
  const route = homeRouteFor(state);

  if (!route) {
    return <AuthSplash />;
  }

  return <Redirect href={route} />;
}
