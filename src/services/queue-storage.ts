import { Directory, File, Paths } from "expo-file-system";

import { createMemoryStorage, type QueueStorage } from "./set-queue";

// ============================================================================
// File-backed storage for the set queue.
//
// Kept in its own module because it is the only place that touches a native
// module. Nothing under test imports it: the queue takes a QueueStorage port,
// and the tests pass createMemoryStorage(). That is what keeps the queue's rules
// testable in a plain Node environment.
//
// expo-file-system v19's `File.write()` is SYNCHRONOUS, which is the reason it
// was chosen over an async key-value store: the queue is written after every
// mutation, and an async write leaves a window where memory and disk disagree --
// exactly the window a process kill lands in.
//
// Reading is not sync (File implements Blob, whose `text()` returns a Promise),
// but that only affects startup, which SetQueue handles with `restore()`.
// ============================================================================

const QUEUE_DIRECTORY = "cadence";
const QUEUE_FILE = "set-queue.json";

/**
 * Queue file in the app's document directory.
 *
 * Document rather than cache: the cache directory is reclaimable by the OS
 * under storage pressure, which is precisely when a phone that has been
 * offline for an hour would lose the sets it is holding.
 *
 * Falls back to memory rather than throwing. A device whose file system is
 * unavailable should still be able to log a workout -- it just loses the queue
 * if the process dies, which is strictly better than refusing to open the
 * screen at all.
 */
export function createQueueStorage(): QueueStorage {
  try {
    const directory = new Directory(Paths.document, QUEUE_DIRECTORY);
    if (!directory.exists) directory.create({ intermediates: true });

    const file = new File(directory, QUEUE_FILE);

    return {
      read: async () => {
        try {
          return file.exists ? await file.text() : null;
        } catch {
          // An unreadable file is treated as an empty queue by parseQueue; the
          // alternative is a training screen that cannot open.
          return null;
        }
      },
      write: (value) => {
        if (!file.exists) file.create();
        file.write(value);
      },
    };
  } catch {
    return createMemoryStorage();
  }
}
