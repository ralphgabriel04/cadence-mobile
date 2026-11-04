import { createClient } from "@supabase/supabase-js";
import { clearStoredSession, createSecureStorage } from "./secure-storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./constants";
import type { Database } from "@/types/database";

if (!SUPABASE_URL) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL — add it to .env.local"
  );
}

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY — add it to .env.local"
  );
}

const storage = createSecureStorage();

/** Erases the persisted session of this device (used when server sign-out fails). */
export const clearLocalSession = () => clearStoredSession(storage, SUPABASE_URL);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
