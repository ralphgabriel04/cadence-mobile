import "../../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";

import { AuthProvider } from "@/providers/auth-provider";

// Hold the splash until the design-system fonts are in memory: without this the
// first frame renders in the system font and then flashes to DM Sans.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // A font error is not fatal: the app falls back to the system font.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
