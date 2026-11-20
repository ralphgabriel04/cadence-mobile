import type { SupabaseClient } from "@supabase/supabase-js";

import { createActiveSessionStore, type ActiveSession } from "@/services/active-session";
import { createMemoryStore } from "@/services/local-store";
import { createMemoryStorage, SetQueue, type QueuedSet } from "@/services/set-queue";
import { flushPendingCompletion } from "@/services/training-sync";
import { sendSet, startSession } from "@/services/workout-session";
import type { Database } from "@/types/database";

type Err = { message: string; code?: string } | null;

/**
 * exercise_logs.insert and session_logs.upsert answer from scripts (the last
 * upsert answer repeats); a select finds `openLog` as the open session.
 */
function stubDb(
  insertErrors: Err[],
  upsertError: Err | Err[] = null,
  openLog: { id: string; started_at: string } | null = { id: "older", started_at: "2026-08-16T17:00:00Z" },
) {
  const calls: string[] = [];
  const upserts = Array.isArray(upsertError) ? upsertError : [upsertError];
  const db = {
    from: (table: string) => ({
      insert: () => {
        calls.push(`${table}.insert`);
        return Promise.resolve({ error: insertErrors.shift() ?? null });
      },
      upsert: () => {
        calls.push(`${table}.upsert`);
        return Promise.resolve({ error: upserts.length > 1 ? (upserts.shift() ?? null) : (upserts[0] ?? null) });
      },
      select: () => {
        calls.push(`${table}.select`);
        const chain = {
          eq: () => chain,
          limit: () => chain,
          maybeSingle: () => Promise.resolve({ data: openLog, error: null }),
          then: (r: (v: { count: number; error: Err }) => void) => r({ count: 1, error: null }),
        };
        return chain;
      },
      update: () => {
        calls.push(`${table}.update`);
        const chain = {
          eq: () => chain,
          then: (r: (v: { error: Err }) => void) => r({ error: null }),
        };
        return chain;
      },
    }),
  };
  return { db: db as unknown as SupabaseClient<Database>, calls };
}

const entry: QueuedSet = {
  clientId: "c1",
  sessionLogId: "log-offline",
  exerciseId: "ex",
  sessionExerciseId: "se",
  setNumber: 1,
  repsCompleted: 10,
  weightKg: 50,
  rpe: null,
  durationSeconds: null,
  distanceMeters: null,
  notes: null,
  queuedAt: "2026-08-17T18:00:00Z",
  lastAttemptAt: null,
  attempts: 0,
  lastError: null,
  ownerId: "me",
  sessionId: "s",
  sessionStartedAt: "2026-08-17T17:50:00Z",
};

describe("sendSet for a session opened without network (story 5.3)", () => {
  it("creates the missing session log, then sends the set", async () => {
    const { db, calls } = stubDb([{ message: "fk", code: "23503" }, null]);
    await expect(sendSet(entry, db)).resolves.toEqual({ ok: true });
    expect(calls).toEqual(["exercise_logs.insert", "session_logs.upsert", "exercise_logs.insert"]);
  });

  it("creates the log on the code the database really sends (42501, policy before FK — T97e)", async () => {
    const { db, calls } = stubDb([{ message: "new row violates row-level security policy", code: "42501" }, null]);
    await expect(sendSet(entry, db)).resolves.toEqual({ ok: true });
    expect(calls).toEqual(["exercise_logs.insert", "session_logs.upsert", "exercise_logs.insert"]);
  });

  it("a set still refused after creating the log stays refused for good", async () => {
    const rls = { message: "rls", code: "42501" };
    const { db } = stubDb([rls, rls]);
    await expect(sendSet(entry, db)).resolves.toMatchObject({ ok: false, retryable: false });
  });

  it("another open session on the account: the older one is closed, the set is kept", async () => {
    const { db, calls } = stubDb([{ message: "rls", code: "42501" }, null], [{ message: "dup", code: "23505" }, null]);
    const result = await sendSet(entry, db);
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([
      "exercise_logs.insert",
      "session_logs.upsert", // refused: another session is open
      "session_logs.select", // the open one started earlier (16 Aug)...
      "exercise_logs.select",
      "session_logs.update", // ...so it is closed
      "session_logs.upsert", // and this session's log is created
      "exercise_logs.insert",
    ]);
  });

  it("when the open session is the newer one, this older session's log is created closed", async () => {
    const newer = { id: "newer", started_at: "2026-08-18T17:00:00Z" };
    const { db, calls } = stubDb([{ message: "rls", code: "42501" }, null], [{ message: "dup", code: "23505" }, null], newer);
    await expect(sendSet(entry, db)).resolves.toEqual({ ok: true });
    expect(calls).not.toContain("session_logs.update");
    expect(calls.at(-1)).toBe("exercise_logs.insert");
  });

  it("a set sent twice is kept once: the duplicate becomes an update", async () => {
    const { db, calls } = stubDb([{ message: "dup", code: "23505" }]);
    await expect(sendSet(entry, db)).resolves.toEqual({ ok: true });
    expect(calls).toEqual(["exercise_logs.insert", "exercise_logs.update"]);
  });
});

function record(over: Partial<ActiveSession> = {}): ActiveSession {
  return {
    athleteId: "me",
    sessionId: "s",
    sessionLogId: "log-offline",
    startedAt: "2026-08-17T17:50:00Z",
    programAssignmentId: null,
    logged: [],
    completion: {
      completedAt: "2026-08-17T18:40:00Z",
      durationMinutes: 50,
      overallRpe: null,
      notes: null,
    },
    ...over,
  };
}

describe("flushPendingCompletion (story 5.5, criterion 5)", () => {
  it("waits while a set of that session is still unsent", async () => {
    const store = createActiveSessionStore(createMemoryStore());
    store.write(record());
    const queue = new SetQueue(
      createMemoryStorage(),
      async () => ({ ok: false, message: "offline", retryable: true }),
      Date.now,
      "me"
    );
    await queue.restore();
    queue.add(entry);
    const complete = jest.fn();
    const result = await flushPendingCompletion("me", {
      store,
      queue,
      complete,
      ensure: jest.fn(),
    });
    expect(result).toEqual({ status: "waiting", pendingSets: 1 });
    expect(complete).not.toHaveBeenCalled();
    expect(await store.read("me")).not.toBeNull();
  });

  it("sends the completion once every set is in, then forgets the record", async () => {
    const store = createActiveSessionStore(createMemoryStore());
    store.write(record());
    const queue = new SetQueue(createMemoryStorage(), async () => ({ ok: true }), Date.now, "me");
    await queue.restore();
    const complete = jest.fn(async () => ({ ok: true as const }));
    const ensure = jest.fn(async () => ({ ok: true as const }));
    const result = await flushPendingCompletion("me", { store, queue, complete, ensure });
    expect(result).toEqual({ status: "sent" });
    expect(ensure).toHaveBeenCalledWith(
      expect.objectContaining({ sessionLogId: "log-offline", sessionId: "s" })
    );
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ sessionLogId: "log-offline", durationMinutes: 50 })
    );
    expect(await store.read("me")).toBeNull();
  });

  it("sends the finished session it is given, and leaves the new session's record alone", async () => {
    const store = createActiveSessionStore(createMemoryStore());
    const finished = record();
    // The live session already wrote today's record over the finished one.
    store.write(record({ sessionLogId: "log-new", completion: null }));
    const queue = new SetQueue(createMemoryStorage(), async () => ({ ok: true }));
    await queue.restore();
    const complete = jest.fn(async () => ({ ok: true as const }));
    const result = await flushPendingCompletion("me", {
      store,
      queue,
      complete,
      ensure: jest.fn(async () => ({ ok: true as const })),
      record: finished,
    });
    expect(result).toEqual({ status: "sent" });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ sessionLogId: "log-offline" }));
    expect((await store.read("me"))?.sessionLogId).toBe("log-new");
  });

  it("does nothing for another account's record", async () => {
    const store = createActiveSessionStore(createMemoryStore());
    store.write(record({ athleteId: "someone-else" }));
    expect(await flushPendingCompletion("me", { store })).toEqual({ status: "nothing" });
  });
});

describe("startSession and a session left open (story 5.3)", () => {
  function startDb(open: { id: string; session_id: string; started_at: string }) {
    const calls: string[] = [];
    const chain = (table: string) => {
      const c = {
        eq: () => c,
        limit: () => c,
        maybeSingle: () => Promise.resolve({ data: open, error: null }),
        single: () => Promise.resolve({ data: { id: "phone-id" }, error: null }),
        select: () => c,
        then: (r: (v: { count: number; error: null }) => void) => r({ count: 2, error: null }),
      };
      calls.push(table);
      return c;
    };
    const db = {
      from: (table: string) => ({
        select: () => chain(`${table}.select`),
        update: () => chain(`${table}.update`),
        insert: () => chain(`${table}.insert`),
      }),
    };
    return { db: db as unknown as SupabaseClient<Database>, calls };
  }

  it("resumes the same session opened today", async () => {
    const { db } = startDb({ id: "today-log", session_id: "s", started_at: new Date().toISOString() });
    const r = await startSession({ sessionId: "s", athleteId: "me", sessionLogId: "phone-id", client: db });
    expect(r).toEqual({ ok: true, sessionLogId: "today-log", resumed: true });
  });

  it("does not resume the same session left open last week: closes it, opens today's", async () => {
    const { db, calls } = startDb({ id: "last-week", session_id: "s", started_at: "2020-01-06T17:00:00Z" });
    const r = await startSession({ sessionId: "s", athleteId: "me", sessionLogId: "phone-id", client: db });
    expect(r).toEqual({ ok: true, sessionLogId: "phone-id", resumed: false });
    expect(calls).toContain("session_logs.update");
  });
});
