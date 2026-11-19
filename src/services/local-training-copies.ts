import { activeSessionStore } from "./active-session";
import { todayCache } from "./today-cache";

/**
 * Erases the copies of training data kept on the phone besides the set queue
 * (the last home screen, story 4.1, and the session in progress, story 5.3).
 * Called when the account is deleted
 * (story 2.6). Never throws: a deletion must not fail because of the phone.
 */
export function eraseLocalTrainingCopies(): void {
  for (const erase of [() => todayCache().erase(), () => activeSessionStore().erase()]) {
    try {
      erase();
    } catch {
      // Unopenable storage holds nothing to erase.
    }
  }
}
