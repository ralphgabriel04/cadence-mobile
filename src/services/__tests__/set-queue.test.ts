import {
  backoffMs,
  closeAllSetQueues,
  createMemoryStorage,
  dueEntries,
  enqueue,
  MAX_QUEUE_LENGTH,
  parseQueue,
  SetQueue,
  type QueuedSet,
  type QueueStorage,
  type SendResult,
} from "@/services/set-queue";

function set(overrides: Partial<QueuedSet> = {}): QueuedSet {
  return {
    clientId: "c1",
    sessionLogId: "sl-1",
    exerciseId: "ex-1",
    sessionExerciseId: "se-1",
    setNumber: 1,
    repsCompleted: 10,
    weightKg: 60,
    rpe: null,
    durationSeconds: null,
    distanceMeters: null,
    notes: null,
    queuedAt: "2026-08-17T18:00:00.000Z",
    lastAttemptAt: null,
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

// ── Pure queue rules ─────────────────────────────────────────────────────────

describe("enqueue", () => {
  it("appends a new slot", () => {
    const q = enqueue(enqueue([], set()), set({ clientId: "c2", setNumber: 2 }));
    expect(q).toHaveLength(2);
  });

  it("replaces an unsent set for the same slot instead of appending", () => {
    // An athlete correcting set 3 before it has been sent must produce ONE
    // request carrying the corrected value -- not the wrong value followed by
    // the right one, whose outcome then depends on ordering.
    const first = set({ clientId: "c1", setNumber: 3, repsCompleted: 8 });
    const corrected = set({ clientId: "c2", setNumber: 3, repsCompleted: 10 });

    const q = enqueue(enqueue([], first), corrected);

    expect(q).toHaveLength(1);
    expect(q[0]?.repsCompleted).toBe(10);
  });

  it("treats the same set number of a different exercise as a different slot", () => {
    const q = enqueue(enqueue([], set()), set({ clientId: "c2", exerciseId: "ex-2" }));
    expect(q).toHaveLength(2);
  });

  it("caps the queue, dropping the oldest", () => {
    let q: QueuedSet[] = [];
    for (let i = 0; i < MAX_QUEUE_LENGTH + 10; i++) {
      q = enqueue(q, set({ clientId: `c${i}`, setNumber: i }));
    }
    expect(q).toHaveLength(MAX_QUEUE_LENGTH);
    // The newest survive: they are what the athlete just did.
    expect(q[q.length - 1]?.clientId).toBe(`c${MAX_QUEUE_LENGTH + 9}`);
  });
});

describe("backoffMs", () => {
  it("does not wait before the first attempt", () => {
    expect(backoffMs(0)).toBe(0);
  });

  it("doubles, then caps at a minute", () => {
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(2)).toBe(2000);
    expect(backoffMs(4)).toBe(8000);
    // The cap is what makes the queue drain promptly when signal returns,
    // instead of sitting on an hour-long backoff from the outage.
    expect(backoffMs(20)).toBe(60_000);
  });
});

describe("dueEntries", () => {
  const base = Date.parse("2026-08-17T18:00:00.000Z");

  it("returns a fresh entry immediately", () => {
    expect(dueEntries([set()], base)).toHaveLength(1);
  });

  it("holds back an entry still inside its backoff", () => {
    // Backoff runs from the last ATTEMPT, not from the moment it was queued: a
    // set queued ten minutes ago would otherwise be due again the instant it
    // failed, which is a busy loop rather than a backoff.
    const failed = set({ attempts: 3, lastAttemptAt: "2026-08-17T18:00:00.000Z" }); // 4s
    expect(dueEntries([failed], base + 1000)).toHaveLength(0);
    expect(dueEntries([failed], base + 5000)).toHaveLength(1);
  });

  it("ignores queuedAt once an attempt has been made", () => {
    const failed = set({
      attempts: 3,
      queuedAt: "2026-08-17T10:00:00.000Z", // eight hours ago
      lastAttemptAt: "2026-08-17T18:00:00.000Z", // but just tried
    });
    expect(dueEntries([failed], base + 1000)).toHaveLength(0);
  });

  it("sends anyway when the device clock has moved backwards", () => {
    // A timezone fix or a manual date change can put `now` before the last
    // attempt. Treating that as "not due" would park the set until the clock
    // caught up, which may be never.
    const failed = set({ attempts: 5, lastAttemptAt: "2026-08-17T18:00:00.000Z" });
    expect(dueEntries([failed], base - 3_600_000)).toHaveLength(1);
  });

  it("sends anyway when the timestamp is unreadable", () => {
    const failed = set({ attempts: 2, lastAttemptAt: "corrompu" });
    expect(dueEntries([failed], base)).toHaveLength(1);
  });

  it("orders oldest first, then by set number", () => {
    const a = set({ clientId: "a", setNumber: 2, queuedAt: "2026-08-17T18:00:00.000Z" });
    const b = set({ clientId: "b", setNumber: 1, queuedAt: "2026-08-17T18:00:00.000Z" });
    const c = set({ clientId: "c", setNumber: 1, queuedAt: "2026-08-17T17:00:00.000Z" });

    expect(dueEntries([a, b, c], base + 10_000).map((e) => e.clientId)).toEqual(["c", "b", "a"]);
  });
});

describe("parseQueue", () => {
  it("returns empty for null, empty and malformed input", () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue("")).toEqual([]);
    // A corrupt file means the process died mid-write -- which is exactly when
    // the athlete most needs the app to open, so this must not throw.
    expect(parseQueue("{not json")).toEqual([]);
    expect(parseQueue('{"not":"an array"}')).toEqual([]);
  });

  it("drops entries that are not shaped like a queued set", () => {
    const raw = JSON.stringify([set(), { nonsense: true }, null, 42]);
    expect(parseQueue(raw)).toHaveLength(1);
  });

  it("round-trips a real queue", () => {
    const original = [set(), set({ clientId: "c2", setNumber: 2 })];
    expect(parseQueue(JSON.stringify(original))).toEqual(original);
  });
});

// ── Runtime behaviour ────────────────────────────────────────────────────────

describe("SetQueue", () => {
  it("persists on add, so a process kill does not lose the set", async () => {
    const storage = createMemoryStorage();
    const queue = new SetQueue(storage, async () => ({ ok: false, message: "offline", retryable: true }));
    await queue.restore();

    queue.add(set());

    expect(parseQueue(await storage.read())).toHaveLength(1);
  });

  it("writes nothing to disk before the previous queue has been read", async () => {
    // The data-loss bug this guards: add() used to persist immediately, so a set
    // validated while the file read was still in flight overwrote the previous
    // run's queue with a single entry -- destroying every set it was holding.
    const storage = createMemoryStorage();
    storage.write(JSON.stringify([set({ clientId: "old" })]));

    const queue = new SetQueue(storage, async () => ({
      ok: false,
      message: "offline",
      retryable: true,
    }));
    queue.add(set({ clientId: "fresh", exerciseId: "ex-9" }));

    // Disk still holds the previous run untouched.
    expect(parseQueue(await storage.read()).map((q) => q.clientId)).toEqual(["old"]);

    await queue.restore();
    expect(parseQueue(await storage.read()).map((q) => q.clientId).sort()).toEqual([
      "fresh",
      "old",
    ]);
  });

  it("restores pending sets from storage", async () => {
    const storage = createMemoryStorage();
    storage.write(JSON.stringify([set(), set({ clientId: "c2", setNumber: 2 })]));

    const queue = new SetQueue(storage, async () => ({
      ok: false,
      message: "offline",
      retryable: true,
    }));
    await queue.restore();

    expect(queue.pending).toHaveLength(2);
  });

  it("does not let a slow restore overwrite a set validated in the meantime", async () => {
    // Reading the file is async. A set validated between construction and the
    // end of that read must survive -- overwriting it with the older on-disk
    // state is the exact failure this queue exists to prevent.
    const storage = createMemoryStorage();
    storage.write(JSON.stringify([set({ clientId: "old", setNumber: 1 })]));

    const queue = new SetQueue(storage, async () => ({
      ok: false,
      message: "offline",
      retryable: true,
    }));

    queue.add(set({ clientId: "fresh", exerciseId: "ex-9", setNumber: 1 }));
    await queue.restore();

    expect(queue.pending.map((q) => q.clientId).sort()).toEqual(["fresh", "old"]);
  });

  it("survives a storage whose read rejects", async () => {
    const queue = new SetQueue(
      { read: () => Promise.reject(new Error("io")), write: () => undefined },
      async () => ({ ok: true }),
    );
    await expect(queue.restore()).resolves.toBeUndefined();
    expect(queue.pending).toHaveLength(0);
  });

  it("removes a set once it is accepted", async () => {
    const storage = createMemoryStorage();
    const queue = new SetQueue(storage, async () => ({ ok: true }));

    queue.add(set());
    await queue.drain();

    expect(queue.pending).toHaveLength(0);
    expect(parseQueue(await storage.read())).toHaveLength(0);
  });

  it("keeps a set and counts the attempt when the send is retryable", async () => {
    const storage = createMemoryStorage();
    const queue = new SetQueue(storage, async () => ({
      ok: false,
      message: "network down",
      retryable: true,
    }));

    queue.add(set());
    await queue.drain();

    expect(queue.pending).toHaveLength(1);
    expect(queue.pending[0]?.attempts).toBe(1);
    expect(queue.pending[0]?.lastError).toBe("network down");
    expect(queue.pending[0]?.lastAttemptAt).not.toBeNull();
  });

  it("keeps a set the server will never accept, marked as rejected, instead of dropping it", async () => {
    const storage = createMemoryStorage();
    const queue = new SetQueue(storage, async () => ({
      ok: false,
      message: "session no longer exists",
      retryable: false,
    }));
    await queue.restore();

    queue.add(set());
    await queue.drain();

    expect(queue.pending).toHaveLength(1);
    expect(queue.rejected).toHaveLength(1);
    expect(queue.rejected[0]?.lastError).toBe("session no longer exists");
    // Kept on disk too: a process kill must not lose it either.
    expect(parseQueue(await storage.read())[0]?.rejected).toBe(true);
  });

  it("does not let a rejected set block the sets behind it", async () => {
    const storage = createMemoryStorage();
    const queue = new SetQueue(storage, async (entry) =>
      entry.setNumber === 1
        ? { ok: false, message: "check_violation", retryable: false }
        : { ok: true },
    );
    await queue.restore();

    queue.add(set({ clientId: "c1", setNumber: 1 }));
    queue.add(set({ clientId: "c2", setNumber: 2 }));
    await queue.drain();

    expect(queue.pending.map((q) => q.clientId)).toEqual(["c1"]);
  });

  it("never retries a rejected set, and discards it only on request", async () => {
    let calls = 0;
    const queue = new SetQueue(createMemoryStorage(), async () => {
      calls++;
      return { ok: false, message: "denied", retryable: false };
    });
    await queue.restore();

    queue.add(set());
    await queue.drain();
    await queue.drain();
    expect(calls).toBe(1);

    queue.discardRejected();
    expect(queue.pending).toHaveLength(0);
  });

  it("replaces a rejected set when the athlete corrects the same slot", async () => {
    let accept = false;
    const queue = new SetQueue(createMemoryStorage(), async () =>
      accept ? { ok: true } : { ok: false, message: "bad value", retryable: false },
    );
    await queue.restore();

    queue.add(set({ clientId: "c1", weightKg: -5 }));
    await queue.drain();
    expect(queue.rejected).toHaveLength(1);

    accept = true;
    queue.add(set({ clientId: "c1-fixed", weightKg: 60 }));
    await queue.drain();
    expect(queue.pending).toHaveLength(0);
  });

  it("eventually drains everything once the network returns", async () => {
    const storage = createMemoryStorage();
    let online = false;
    let clock = Date.parse("2026-08-17T18:00:00.000Z");

    const queue = new SetQueue(
      storage,
      async () => (online ? { ok: true } : { ok: false, message: "offline", retryable: true }),
      () => clock,
    );

    for (let i = 1; i <= 5; i++) {
      queue.add(set({ clientId: `c${i}`, setNumber: i }));
    }
    await queue.drain();
    expect(queue.pending).toHaveLength(5);

    online = true;
    clock += 120_000; // past the capped backoff
    await queue.drain();

    expect(queue.pending).toHaveLength(0);
  });

  it("sends one entry at a time", async () => {
    const storage = createMemoryStorage();
    let inFlight = 0;
    let maxInFlight = 0;

    const queue = new SetQueue(storage, async (): Promise<SendResult> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return { ok: true };
    });

    for (let i = 1; i <= 4; i++) queue.add(set({ clientId: `c${i}`, setNumber: i }));
    await queue.drain();

    // A phone on a weak signal does worse with concurrent requests, and serial
    // draining makes the failure handling trivial to reason about.
    expect(maxInFlight).toBe(1);
  });

  it("does not start a second drain while one is running", async () => {
    const storage = createMemoryStorage();
    let calls = 0;
    const queue = new SetQueue(storage, async () => {
      calls += 1;
      await Promise.resolve();
      return { ok: true };
    });

    queue.add(set({ clientId: "c1", setNumber: 1 }));
    await Promise.all([queue.drain(), queue.drain(), queue.drain()]);

    expect(calls).toBe(1);
  });

  it("survives a storage that throws on write", async () => {
    const exploding: QueueStorage = {
      read: () => Promise.resolve(null),
      write: () => {
        throw new Error("disk full");
      },
    };
    const queue = new SetQueue(exploding, async () => ({ ok: true }));

    // The set still lives in memory and still sends; only a process kill during
    // a storage outage loses it.
    expect(() => queue.add(set())).not.toThrow();
    await queue.drain();
    expect(queue.pending).toHaveLength(0);
  });

  it("notifies subscribers on every change", async () => {
    const storage = createMemoryStorage();
    const queue = new SetQueue(storage, async () => ({ ok: true }));
    const seen: number[] = [];
    const unsubscribe = queue.subscribe((q) => seen.push(q.length));

    queue.add(set());
    await queue.drain();
    unsubscribe();
    queue.add(set({ clientId: "c2", setNumber: 2 }));

    expect(seen).toEqual([1, 0]);
  });
});

// ── Account deletion: the local queue must not outlive the account ───────────

describe("SetQueue.close (account deleted)", () => {
  const retryable: SendResult = { ok: false, message: "net", retryable: true };

  it("forgets pending and refused sets, empties the file, ignores later adds", async () => {
    const storage = createMemoryStorage();
    const q = new SetQueue(storage, async (e) =>
      e.clientId === "refused" ? { ok: false, message: "no", retryable: false } : retryable
    );
    await q.restore();
    q.add(set({ clientId: "waiting", setNumber: 1 }));
    q.add(set({ clientId: "refused", setNumber: 2 }));
    await q.drain();
    expect(q.pending).toHaveLength(2); // control: both really were held
    expect(q.rejected).toHaveLength(1);

    q.close();
    q.add(set({ clientId: "late", setNumber: 3 }));

    expect(q.pending).toHaveLength(0);
    expect(parseQueue(await storage.read())).toEqual([]);
  });

  it("a send finishing after close cannot write the set back", async () => {
    const storage = createMemoryStorage();
    let finish: (r: SendResult) => void = () => {};
    const q = new SetQueue(storage, () => new Promise<SendResult>((r) => (finish = r)));
    await q.restore();
    q.add(set({ clientId: "in-flight" }));
    expect(parseQueue(await storage.read())).toHaveLength(1);

    q.close();
    finish(retryable); // would normally mark the set as failed and persist it
    await q.drain();

    expect(q.pending).toHaveLength(0);
    expect(parseQueue(await storage.read())).toEqual([]);
  });

  it("the next account does not get the old account's sets back", async () => {
    const storage = createMemoryStorage();
    const old = new SetQueue(storage, async () => retryable);
    await old.restore();
    old.add(set());
    old.close();

    const next = new SetQueue(storage, async () => ({ ok: true }));
    await next.restore();
    expect(next.pending).toHaveLength(0);
  });

  it("closeAllSetQueues closes every live queue, including ones whose screen is gone", async () => {
    const s1 = createMemoryStorage();
    const s2 = createMemoryStorage();
    const a = new SetQueue(s1, async () => retryable);
    const b = new SetQueue(s2, async () => retryable);
    await a.restore();
    await b.restore();
    a.add(set({ clientId: "a" }));
    b.add(set({ clientId: "b" }));

    closeAllSetQueues();

    expect(a.pending).toHaveLength(0);
    expect(b.pending).toHaveLength(0);
    expect(parseQueue(await s1.read())).toEqual([]);
    expect(parseQueue(await s2.read())).toEqual([]);
  });
});

describe("listener isolation on close", () => {
  it("a listener that throws does not stop the others or the other queues", async () => {
    const retry: SendResult = { ok: false, message: "net", retryable: true };
    const a = new SetQueue(createMemoryStorage(), async () => retry);
    const b = new SetQueue(createMemoryStorage(), async () => retry);
    await a.restore();
    await b.restore();
    const heard: number[] = [];
    a.subscribe(() => {
      throw new Error("bad listener");
    });
    a.subscribe((q) => heard.push(q.length));
    a.add(set({ clientId: "a" }));
    b.add(set({ clientId: "b" }));
    heard.length = 0;

    expect(() => closeAllSetQueues()).not.toThrow();

    expect(heard).toEqual([0]); // the second listener on the same queue still heard it
    expect(a.pending).toHaveLength(0);
    expect(b.pending).toHaveLength(0);
  });
});

describe("SetQueue owner", () => {
  it("stamps added sets with the owner and reloads only that owner's sets", async () => {
    const storage = createMemoryStorage();
    storage.write(
      JSON.stringify([set({ clientId: "mine", ownerId: "a" }), set({ clientId: "theirs", ownerId: "b" }), set({ clientId: "legacy" })])
    );
    const q = new SetQueue(storage, async () => ({ ok: false, message: "x", retryable: true }), Date.now, "a");
    await q.restore();
    expect(q.pending.map((p) => p.clientId)).toEqual(["mine"]);
    q.add(set({ clientId: "new", setNumber: 2 }));
    expect(q.pending.find((p) => p.clientId === "new")?.ownerId).toBe("a");
    expect(JSON.parse((await storage.read()) ?? "[]").map((p: QueuedSet) => p.clientId)).toEqual(["mine", "new"]);
  });
});
