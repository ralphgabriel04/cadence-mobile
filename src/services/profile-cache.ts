import type { Profile } from "@/providers/auth-state";

import { createLocalStore, type LocalStore } from "./local-store";

// ============================================================================
// Last profile loaded on this phone, for story 4.1 criterion 4: opening the app
// without network must reach the home screen (and its offline copy) instead of
// stopping on « Impossible de charger le profil ».
//
// Only read for the user of the stored session, and only when the profile
// request failed for lack of network. Erased with the account (story 2.6).
// ============================================================================

const FILE_NAME = "profile-cache.json";

export function createProfileCache(store: LocalStore = createLocalStore(FILE_NAME)) {
  return {
    save(profile: Profile) {
      store.write(JSON.stringify(profile));
    },

    async read(userId: string): Promise<Profile | null> {
      const raw = await store.read();
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Partial<Profile>;
        if (parsed.id !== userId) return null;
        if (parsed.role !== "athlete" && parsed.role !== "coach") return null;
        return parsed as Profile;
      } catch {
        return null;
      }
    },

    erase() {
      store.erase();
    },
  };
}

export type ProfileCache = ReturnType<typeof createProfileCache>;

let shared: ProfileCache | null = null;

export function profileCache(): ProfileCache {
  shared ??= createProfileCache();
  return shared;
}
