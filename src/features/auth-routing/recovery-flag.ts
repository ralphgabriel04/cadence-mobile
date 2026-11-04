import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * "A password recovery is in progress" marker, outside React state so it survives
 * a restart: the recovery session is persisted, and an armed marker at startup
 * means "sign it out". Armed BEFORE the tokens become a session.
 */
const KEY = "cadence.recovery-in-progress";

async function read(): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(KEY);
  return SecureStore.getItemAsync(KEY);
}

export async function armRecovery(): Promise<void> {
  try {
    if (Platform.OS === "web") localStorage.setItem(KEY, "1");
    else await SecureStore.setItemAsync(KEY, "1");
  } catch {
    // see above
  }
}

export async function disarmRecovery(): Promise<void> {
  try {
    if (Platform.OS === "web") localStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // see above
  }
}

export async function isRecoveryArmed(): Promise<boolean> {
  try {
    return (await read()) === "1";
  } catch {
    return false;
  }
}
