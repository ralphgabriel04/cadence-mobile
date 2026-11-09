import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Storage handed to the Supabase auth client so the session survives closing the
 * app: tokens go to the device keychain (SecureStore), or localStorage on web.
 * `platform` is a parameter only so tests can pick the branch.
 */
export function createSecureStorage(platform: string = Platform.OS) {
  const web = platform === "web";
  return {
    getItem: (key: string) => (web ? localStorage.getItem(key) : SecureStore.getItemAsync(key)),
    setItem: (key: string, value: string) => {
      if (web) {
        localStorage.setItem(key, value);
        return;
      }
      return SecureStore.setItemAsync(key, value);
    },
    removeItem: (key: string) => {
      if (web) {
        localStorage.removeItem(key);
        return;
      }
      return SecureStore.deleteItemAsync(key);
    },
  };
}

/** Default key auth-js stores the session under for a given project URL. */
export function authStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

/** Removes every auth-js entry for this project from the device storage. */
export async function clearStoredSession(
  storage: ReturnType<typeof createSecureStorage>,
  supabaseUrl: string
): Promise<void> {
  const key = authStorageKey(supabaseUrl);
  for (const k of [key, `${key}-user`, `${key}-code-verifier`]) {
    await storage.removeItem(k);
  }
}
