import * as SecureStore from "expo-secure-store";

import { eraseQueueFile } from "./queue-storage";
import { closeAllSetQueues } from "./set-queue";

export type PurgeResult = { erased: boolean };

/**
 * "A purge was refused and not yet redone", kept in the keychain: the disk that
 * refused the delete is the one place the flag cannot live.
 */
export type PurgeMarker = {
  set(): Promise<void>;
  clear(): Promise<void>;
  isSet(): Promise<boolean>;
};

const MARKER_KEY = "cadence-queue-purge-pending";

export function createSecureMarker(
  store: Pick<typeof SecureStore, "getItemAsync" | "setItemAsync" | "deleteItemAsync"> = SecureStore
): PurgeMarker {
  return {
    set: () => store.setItemAsync(MARKER_KEY, "1"),
    clear: () => store.deleteItemAsync(MARKER_KEY),
    isSet: async () => typeof (await store.getItemAsync(MARKER_KEY)) === "string",
  };
}

/**
 * Erases the sets this device still holds for a deleted account.
 *
 * Supabase's sign-out only touches the auth storage, not cadence/set-queue.json,
 * and a queue created by a workout screen keeps draining after the screen is
 * gone. So: close every live queue, then delete the file and read the result back.
 * If the file survives, a marker is left so the next launch neither reloads nor
 * sends those sets (see mayRestore). Nothing here throws.
 */
export function createLocalQueuePurger(deps: { erase: () => PurgeResult; marker: PurgeMarker }) {
  // The marker itself can fail to write; this keeps the same process safe anyway.
  let pendingInProcess = false;

  async function tryErase(): Promise<boolean> {
    try {
      return deps.erase().erased === true;
    } catch {
      return false;
    }
  }

  return {
    async purge(): Promise<PurgeResult> {
      try {
        closeAllSetQueues();
      } catch {
        // closeAllSetQueues isolates each queue already; this is the last net.
      }
      if (await tryErase()) {
        pendingInProcess = false;
        await deps.marker.clear().catch(() => undefined);
        return { erased: true };
      }
      pendingInProcess = true;
      await deps.marker.set().catch(() => undefined);
      return { erased: false };
    },

    /** False while a refused purge is still outstanding: do not restore or send the old sets. */
    async mayRestore(): Promise<boolean> {
      let marked = pendingInProcess;
      if (!marked) {
        try {
          marked = await deps.marker.isSet();
        } catch {
          // Unreadable keychain: cannot know, so do not block a healthy queue forever.
          marked = false;
        }
      }
      if (!marked) return true;
      if (!(await tryErase())) return false;
      pendingInProcess = false;
      await deps.marker.clear().catch(() => undefined);
      return true;
    },
  };
}

const purger = createLocalQueuePurger({ erase: eraseQueueFile, marker: createSecureMarker() });
export const purgeLocalSetQueue = purger.purge;
export const mayRestoreLocalQueue = purger.mayRestore;
