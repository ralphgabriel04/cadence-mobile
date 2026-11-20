import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

// ============================================================================
// Small JSON documents kept on the device (stories 4.1 and 5.3).
//
// One file per document under <document>/cadence/, the same place as the set
// queue: the document directory is not reclaimed by the OS under storage
// pressure, which is when a phone that has been offline for an hour needs it.
// On the web there is no app file system, so localStorage is used instead.
//
// Writes are synchronous for the same reason as the queue (a process kill must
// not land between memory and disk). Every operation swallows its own errors:
// a device whose storage fails must still be able to show a screen.
// ============================================================================

export interface LocalStore {
  read(): Promise<string | null>;
  write(value: string): void;
  erase(): void;
}

const DIRECTORY = "cadence";

/** In-memory store, for tests and for devices without a usable file system. */
export function createMemoryStore(initial: string | null = null): LocalStore {
  let value = initial;
  return {
    read: () => Promise.resolve(value),
    write: (next) => {
      value = next;
    },
    erase: () => {
      value = null;
    },
  };
}

function webStore(key: string): LocalStore | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage) return null;
    const fullKey = `${DIRECTORY}/${key}`;
    return {
      read: () => {
        try {
          return Promise.resolve(storage.getItem(fullKey));
        } catch {
          return Promise.resolve(null);
        }
      },
      write: (value) => {
        try {
          storage.setItem(fullKey, value);
        } catch {
          // Quota or private mode: the screen still works, only the cache is lost.
        }
      },
      erase: () => {
        try {
          storage.removeItem(fullKey);
        } catch {
          // nothing to do
        }
      },
    };
  } catch {
    return null;
  }
}

/** File-backed store named `fileName` (for example "today-cache.json"). */
export function createLocalStore(fileName: string, platform: string = Platform.OS): LocalStore {
  if (platform === "web") return webStore(fileName) ?? createMemoryStore();
  try {
    const directory = new Directory(Paths.document, DIRECTORY);
    if (!directory.exists) directory.create({ intermediates: true });
    const file = new File(directory, fileName);
    return {
      read: async () => {
        try {
          return file.exists ? await file.text() : null;
        } catch {
          return null;
        }
      },
      write: (value) => {
        try {
          if (!file.exists) file.create();
          file.write(value);
        } catch {
          // Unwritable disk: keep going without the copy.
        }
      },
      erase: () => {
        try {
          if (file.exists) file.delete();
        } catch {
          // A file that cannot be deleted is overwritten at the next write.
        }
      },
    };
  } catch {
    return createMemoryStore();
  }
}
