import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * "A password recovery is in progress" marker, kept outside React state so it
 * survives an app restart. The recovery session is a real, persisted session:
 * without this marker a relaunch would resume it as an ordinary login and open
 * the athlete space without a password. At startup an armed marker means "sign
 * this session out".
 *
 * Armed BEFORE the recovery tokens are turned into a session, so a crash between
 * the two still ends in a sign-out. Storage failures read as "not armed" for
 * reads and are swallowed for writes: the in-memory state still guards the run.
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
