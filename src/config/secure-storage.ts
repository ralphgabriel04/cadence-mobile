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
