import type { TodayScreenData } from "@/types/today-screen";

import { createLocalStore, type LocalStore } from "./local-store";
import { parseTodayScreen } from "./today-session";

// ============================================================================
// Last known home screen, for story 4.1 criterion 4: without network, the
// athlete still sees the last session the app knew about, with « Hors ligne ».
//
// The copy is tied to the account that fetched it. Another account signing in
// on the same phone never sees it: read() returns null when the owner differs.
// ============================================================================

const FILE_NAME = "today-cache.json";

export type CachedToday = {
  athleteId: string;
  /** ISO timestamp of the fetch that produced `data`. */
  savedAt: string;
  data: TodayScreenData;
};

export function createTodayCache(store: LocalStore = createLocalStore(FILE_NAME)) {
  return {
    save(athleteId: string, data: TodayScreenData, savedAt: string = new Date().toISOString()) {
      if (!athleteId) return;
      store.write(JSON.stringify({ athleteId, savedAt, data } satisfies CachedToday));
    },

    async read(athleteId: string): Promise<CachedToday | null> {
      if (!athleteId) return null;
      const raw = await store.read();
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Partial<CachedToday>;
        if (parsed.athleteId !== athleteId || typeof parsed.savedAt !== "string") return null;
        // Re-validated with the same contract as the network payload: a copy
        // written by an older version of the app must not crash the screen.
        return { athleteId, savedAt: parsed.savedAt, data: parseTodayScreen(parsed.data) };
      } catch {
        return null;
      }
    },

    erase() {
      store.erase();
    },
  };
}

export type TodayCache = ReturnType<typeof createTodayCache>;

let shared: TodayCache | null = null;

/** The app's cache, created on first use (it touches the file system). */
export function todayCache(): TodayCache {
  shared ??= createTodayCache();
  return shared;
}
