import type { SupabaseClient } from "@supabase/supabase-js";

import { createActiveSessionStore, type ActiveSession } from "@/services/active-session";
import { createMemoryStore } from "@/services/local-store";
import { createMemoryStorage, SetQueue, type QueuedSet } from "@/services/set-queue";
import { flushPendingCompletion } from "@/services/training-sync";
import { sendSet } from "@/services/workout-session";
import type { Database } from "@/types/database";

type Err = { message: string; code?: string } | null;

/** exercise_logs.insert answers from a script; session_logs.upsert records the call. */
function stubDb(insertErrors: Err[], upsertError: Err = null) {
  const calls: string[] = [];
  const db = {
    from: (table: string) => ({
      insert: () => {
        calls.push(`${table}.insert`);
        return Promise.resolve({ error: insertErrors.shift() ?? null });
      },
      upsert: () => {
        calls.push(`${table}.upsert`);
        return Promise.resolve({ error: upsertError });
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

  it("refuses for good when another session is open on the account", async () => {
    const { db } = stubDb([{ message: "fk", code: "23503" }], { message: "dup", code: "23505" });
    const result = await sendSet(entry, db);
    expect(result).toMatchObject({ ok: false, retryable: false });
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

  it("does nothing for another account's record", async () => {
    const store = createActiveSessionStore(createMemoryStore());
    store.write(record({ athleteId: "someone-else" }));
    expect(await flushPendingCompletion("me", { store })).toEqual({ status: "nothing" });
  });
});
