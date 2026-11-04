import { createClient } from "@supabase/supabase-js";

import { createSecureStorage } from "../secure-storage";

// In-memory stand-in for the device mockKeychain. It outlives both clients below,
// exactly as the mockKeychain outlives the app process.
const mockKeychain = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => mockKeychain.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockKeychain.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockKeychain.delete(k)),
}));

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  email: "athlete@cadence.test",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.sig`;

function newClient() {
  return createClient("http://localhost:54321", "anon-test", {
    auth: {
      storage: createSecureStorage("ios"),
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

beforeEach(() => mockKeychain.clear());

describe("2.2 · session persistence", () => {
  // Critère 3 : fermer et rouvrir l'app = deuxième client sur le même stockage.
  it("a new client (app restart) finds the session saved by the first", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            access_token: jwt,
            refresh_token: "r",
            expires_in: 3600,
            token_type: "bearer",
            user: USER,
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    ) as typeof fetch;

    const first = newClient();
    const { error } = await first.auth.signInWithPassword({
      email: USER.email,
      password: "unused-in-test",
    });
    expect(error).toBeNull();
    expect(mockKeychain.size).toBeGreaterThan(0);

    const restarted = newClient();
    const { data } = await restarted.auth.getSession();
    expect(data.session?.user.id).toBe(USER.id);
  });

  it("is gone after sign-out (nothing left in the mockKeychain)", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            access_token: jwt,
            refresh_token: "r",
            expires_in: 3600,
            token_type: "bearer",
            user: USER,
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    ) as typeof fetch;
    const first = newClient();
    await first.auth.signInWithPassword({ email: USER.email, password: "x" });
    await first.auth.signOut({ scope: "local" });

    const { data } = await newClient().auth.getSession();
    expect(data.session).toBeNull();
  });
});
