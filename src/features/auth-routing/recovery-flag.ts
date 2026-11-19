import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Two small markers kept outside React state so they survive an app restart.
 * Storage failures read as "absent" and are swallowed on write: the in-memory
 * state still guards the current run.
 *
 * IN PROGRESS: a password recovery is open. The recovery session is a real,
 * persisted session; without this marker a relaunch would resume it as an
 * ordinary login and open the athlete space without a password. At startup an
 * armed marker means "sign this session out". It is armed BEFORE the recovery
 * tokens become a session, so a crash between the two still ends in a sign-out.
 *
 * REQUESTED: this device asked for a recovery email (timestamp). A recovery link
 * is only accepted while a fresh request exists, which ties the link to the flow
 * the app started instead of to whatever tokens a caller puts in a URL.
 */
const IN_PROGRESS_KEY = "cadence.recovery-in-progress";
const REQUESTED_KEY = "cadence.recovery-requested";

/** Same as the default lifetime of the emailed link (otp_expiry, one hour). */
export const REQUEST_MAX_AGE_MS = 60 * 60 * 1000;

async function get(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function set(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // see above
  }
}

async function del(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // see above
  }
}

// The in-progress marker fails closed: callers learn whether the write worked,
// and an unreadable marker is "unknown", never "not armed".
async function tried(fn: () => unknown): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}
const web = Platform.OS === "web";
export const armRecovery = () =>
  tried(() =>
    web
      ? localStorage.setItem(IN_PROGRESS_KEY, "1")
      : SecureStore.setItemAsync(IN_PROGRESS_KEY, "1")
  );
export const disarmRecovery = () =>
  tried(() =>
    web ? localStorage.removeItem(IN_PROGRESS_KEY) : SecureStore.deleteItemAsync(IN_PROGRESS_KEY)
  );
export async function readRecoveryMarker(): Promise<"armed" | "clear" | "unknown"> {
  try {
    const v = web
      ? localStorage.getItem(IN_PROGRESS_KEY)
      : await SecureStore.getItemAsync(IN_PROGRESS_KEY);
    return v === "1" ? "armed" : "clear";
  } catch {
    return "unknown";
  }
}

export const markRecoveryRequested = (now = Date.now()) => set(REQUESTED_KEY, String(now));
export const clearRecoveryRequest = () => del(REQUESTED_KEY);
export async function hasFreshRecoveryRequest(now = Date.now()): Promise<boolean> {
  const at = Number(await get(REQUESTED_KEY));
  return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at <= REQUEST_MAX_AGE_MS;
}
