import { createLocalQueuePurger, type PurgeMarker } from "../purge-local-queue";
import { createMemoryStorage, parseQueue, SetQueue, type QueuedSet } from "../set-queue";

jest.mock("../queue-storage", () => ({ eraseQueueFile: jest.fn() }));

// A COMPLETE set: parseQueue would silently drop anything less, which made the first version of this test prove nothing.
const old: QueuedSet = {
  clientId: "old-account-set",
  sessionLogId: "sl-old",
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
};

// The marker lives in the keychain, not in the file: it has to survive a refused disk.
function fakeMarker(opts: { failWrites?: boolean } = {}): PurgeMarker & { value: boolean } {
  const m = {
    value: false,
    set: async () => {
      if (opts.failWrites) throw new Error("keychain locked");
      m.value = true;
    },
    clear: async () => {
      m.value = false;
    },
    isSet: async () => m.value,
  };
  return m;
}

describe("purgeLocalSetQueue", () => {
  it("says erased only when the file is really gone, closes live queues, leaves no marker", async () => {
    const marker = fakeMarker();
    const live = new SetQueue(createMemoryStorage(), async () => ({
      ok: false,
      message: "x",
      retryable: true,
    }));
    await live.restore();
    live.add({ ...old, clientId: "waiting" });
    expect(live.pending).toHaveLength(1);

    const purger = createLocalQueuePurger({ erase: () => ({ erased: true }), marker });
    expect(await purger.purge()).toEqual({ erased: true });
    expect(live.pending).toHaveLength(0);
    expect(marker.value).toBe(false);
  });

  it("says not erased and keeps a marker when the file cannot be removed", async () => {
    const marker = fakeMarker();
    const purger = createLocalQueuePurger({ erase: () => ({ erased: false }), marker });
    expect(await purger.purge()).toEqual({ erased: false });
    expect(marker.value).toBe(true);
  });

  it("never throws: an eraser that throws counts as not erased", async () => {
    const marker = fakeMarker();
    const purger = createLocalQueuePurger({
      erase: () => {
        throw new Error("disk refused");
      },
      marker,
    });
    await expect(purger.purge()).resolves.toEqual({ erased: false });
    expect(marker.value).toBe(true);
  });
});

describe("next launch after a refused purge", () => {
  async function relaunch(
    purger: ReturnType<typeof createLocalQueuePurger>,
    storage = createMemoryStorage()
  ) {
    const send = jest.fn(async () => ({ ok: true }) as const);
    const queue = new SetQueue(storage, send);
    if (await purger.mayRestore()) await queue.restore();
    await queue.drain();
    return { queue, send };
  }

  it("does not reload or send the old account's sets while the file is still refused", async () => {
    const storage = createMemoryStorage();
    storage.write(JSON.stringify([old])); // left on disk: the purge was refused
    const marker = fakeMarker();
    const first = createLocalQueuePurger({ erase: () => ({ erased: false }), marker });
    await first.purge();

    // New process: same keychain marker, fresh purger, disk still refusing.
    const second = createLocalQueuePurger({ erase: () => ({ erased: false }), marker });
    const { queue, send } = await relaunch(second, storage);

    expect(queue.pending).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
    expect(marker.value).toBe(true);
    expect(parseQueue(await storage.read())).toHaveLength(1); // control: the set really was on disk and valid
  });

  it("retries the erase, clears the marker and restores normally once the disk works again", async () => {
    const marker = fakeMarker();
    marker.value = true;
    const erase = jest.fn(() => ({ erased: true }));
    const purger = createLocalQueuePurger({ erase, marker });

    expect(await purger.mayRestore()).toBe(true);
    expect(erase).toHaveBeenCalledTimes(1);
    expect(marker.value).toBe(false);
  });

  it("with no marker, restores without touching the file", async () => {
    const erase = jest.fn(() => ({ erased: true }));
    const purger = createLocalQueuePurger({ erase, marker: fakeMarker() });
    expect(await purger.mayRestore()).toBe(true);
    expect(erase).not.toHaveBeenCalled();
  });

  it("if even the marker cannot be written, the same process still refuses to restore", async () => {
    const purger = createLocalQueuePurger({
      erase: () => ({ erased: false }),
      marker: fakeMarker({ failWrites: true }),
    });
    expect(await purger.purge()).toEqual({ erased: false });
    expect(await purger.mayRestore()).toBe(false);
  });
});
