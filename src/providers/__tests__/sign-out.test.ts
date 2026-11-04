import { createClient } from "@supabase/supabase-js";

import { clearStoredSession, createSecureStorage } from "@/config/secure-storage";
import { signOutAndClearLocal } from "../sign-out";

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
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let logoutBehaviour: "ok" | "500" | "network";
beforeEach(() => {
  mockKeychain.clear();
  logoutBehaviour = "ok";
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/logout")) {
      if (logoutBehaviour === "network") throw new TypeError("Network request failed");
      return logoutBehaviour === "500"
        ? json(500, { msg: "boom" })
        : new Response(null, { status: 204 });
    }
    return json(200, {
      access_token: jwt,
      refresh_token: "r",
      expires_in: 3600,
      token_type: "bearer",
      user: USER,
    });
  }) as typeof fetch;
});

const URL_LOCAL = "http://localhost:54321";
const clear = () => clearStoredSession(createSecureStorage("ios"), URL_LOCAL);

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

async function signedInClient() {
  const client = newClient();
  const { error } = await client.auth.signInWithPassword({ email: USER.email, password: "x" });
  expect(error).toBeNull();
  // positive control: the session really is stored before we sign out
  expect((await client.auth.getSession()).data.session).not.toBeNull();
  expect(mockKeychain.size).toBeGreaterThan(0);
  return client;
}

describe("2.2 · sign-out clears the local session", () => {
  it("normal path (default scope): key removed, a new client finds nothing", async () => {
    const client = await signedInClient();
    expect(await signOutAndClearLocal(client.auth, clear)).toBe(true);
    expect(mockKeychain.size).toBe(0);
    expect((await newClient().auth.getSession()).data.session).toBeNull();
  });

  it("server answers 500: the local session is still removed", async () => {
    const client = await signedInClient();
    logoutBehaviour = "500";
    expect(await signOutAndClearLocal(client.auth, clear)).toBe(false);
    expect(mockKeychain.size).toBe(0);
    expect((await newClient().auth.getSession()).data.session).toBeNull();
  });

  it("network down: the local session is still removed", async () => {
    const client = await signedInClient();
    logoutBehaviour = "network";
    await signOutAndClearLocal(client.auth, clear);
    expect(mockKeychain.size).toBe(0);
    expect((await newClient().auth.getSession()).data.session).toBeNull();
  });

  it("a rejected promise falls back to the local scope", async () => {
    const calls: unknown[] = [];
    const auth = {
      signOut: jest.fn(async (opts?: { scope: "global" | "local" | "others" }) => {
        calls.push(opts);
        if (!opts) throw new Error("boom");
        return { error: null };
      }),
    };
    expect(await signOutAndClearLocal(auth)).toBe(false);
    expect(calls).toEqual([undefined, { scope: "local" }]);
  });
});
