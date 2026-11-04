import { createQueueStorage } from "./queue-storage";
import { closeAllSetQueues } from "./set-queue";

/**
 * Erases the sets this device was still holding for the signed-in account.
 *
 * Called once the account is deleted. Supabase's sign-out only touches the auth
 * storage, not cadence/set-queue.json, and a queue created by a workout screen
 * keeps draining after the screen is gone. So: close every live queue (they
 * ignore any send still in flight), then empty the file itself, which also covers
 * a file left by a previous run with no queue alive. Never throws.
 */
export function purgeLocalSetQueue(): void {
  closeAllSetQueues();
  try {
    createQueueStorage().write("[]");
  } catch {
    // Nothing more to do: the live queues were closed above.
  }
}
