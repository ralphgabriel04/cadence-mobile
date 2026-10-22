// ============================================================================
// Durable queue for logged sets (cm#25)
//
// THE PROMISE
// "A set the athlete validated is never lost because a request failed."
//
// HOW IT IS KEPT
// Durability comes from two places, not one:
//
//   1. The DATABASE is the source of truth. A validated set is sent
//      immediately; on success it leaves the queue and never comes back.
//   2. The QUEUE covers the window where the send has not succeeded yet. It is
//      written to disk after every mutation, so it also survives the process
//      being killed -- the realistic gym scenario is no signal in a basement,
//      forty minutes of sets, the app backgrounded to change music, and the OS
//      reclaiming it. An in-memory queue loses everything there.
//
// IDEMPOTENCY
// Retries are safe because migration 005 adds a unique index on
// (session_log_id, exercise_id, set_number) filtered on NOT is_deleted, and the
// sender upserts on that key. A request that actually succeeded but whose
// response was lost is therefore re-sent as a no-op instead of doubling the
// athlete's volume.
//
// WHAT THIS IS NOT
// Not an offline mode. Reading the prescription still needs the network; only
// writes are buffered. Full offline is out of scope for v1.0.
// ============================================================================

/** A set waiting to reach the server. */
export type QueuedSet = {
  /** Stable client-side id, used for dedupe inside the queue itself. */
  clientId: string;
  sessionLogId: string;
  exerciseId: string;
  sessionExerciseId: string | null;
  setNumber: number;
  repsCompleted: number | null;
  weightKg: number | null;
  rpe: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  notes: string | null;
  /** ISO timestamp, for ordering and for the "queued for a while" indicator. */
  queuedAt: string;
  /**
   * ISO timestamp of the last send attempt, null before the first.
   *
   * Backoff is measured from HERE, not from queuedAt. Measuring from the queue
   * time means a set enqueued ten minutes ago is due again the instant it
   * fails -- there is no backoff at all, just a busy loop against a network
   * that is already down.
   */
  lastAttemptAt: string | null;
  attempts: number;
  lastError: string | null;
  /**
   * True once the server has refused this set for good (a check, a missing
   * session, a denied write). A rejected set is NEVER silently dropped: it
   * stays in the queue, is no longer retried, and is surfaced to the athlete,
   * who can correct it (a new value for the same slot replaces it) or discard
   * it. Optional so queues persisted before this field still parse.
   */
  rejected?: boolean;
};

/**
 * Minimal storage port.
 *
 * WRITE IS SYNCHRONOUS, ON PURPOSE. The queue is persisted after every
 * mutation, and an async write leaves a window where memory and disk disagree --
 * exactly the window a process kill lands in. expo-file-system v19's
 * `File.write()` is synchronous, so that window can simply be removed.
 *
 * READ IS ASYNCHRONOUS, because the same API's `File.text()` is not sync (File
 * implements Blob, whose `text()` returns a Promise). That is fine: the read
 * happens once, when the screen opens, and is handled by `restore()` rather than
 * by the constructor.
 */
export interface QueueStorage {
  read(): Promise<string | null>;
  write(value: string): void;
}

/**
 * Hard cap on queue length.
 *
 * A queue that grows without bound turns a connectivity outage into a disk
 * problem and eventually into a startup that cannot parse its own state. 500
 * sets is roughly twenty sessions' worth -- far past any plausible offline
 * stretch, and small enough to serialise instantly.
 */
export const MAX_QUEUE_LENGTH = 500;

// ── Pure operations ─────────────────────────────────────────────────────────
// Exported separately from the runtime object so the ordering, dedupe and
// backoff rules can be tested without any storage or network.

/**
 * Adds a set, replacing any earlier entry for the same slot.
 *
 * Replacing rather than appending matters: an athlete who validates set 3, then
 * goes back and corrects it before it has been sent, must end up with ONE
 * request carrying the corrected value. Appending would send the wrong value
 * first and rely on ordering to fix it.
 */
export function enqueue(queue: readonly QueuedSet[], entry: QueuedSet): QueuedSet[] {
  const withoutSameSlot = queue.filter(
    (q) =>
      !(
        q.sessionLogId === entry.sessionLogId &&
        q.exerciseId === entry.exerciseId &&
        q.setNumber === entry.setNumber
      ),
  );
  const next = [...withoutSameSlot, entry];

  // Drop the OLDEST when full. The newest sets are the ones the athlete just
  // did and still expects to see; the oldest have had the most chances to send.
  return next.length > MAX_QUEUE_LENGTH ? next.slice(next.length - MAX_QUEUE_LENGTH) : next;
}

export function removeById(queue: readonly QueuedSet[], clientId: string): QueuedSet[] {
  return queue.filter((q) => q.clientId !== clientId);
}

export function markFailed(
  queue: readonly QueuedSet[],
  clientId: string,
  message: string,
  at: string,
): QueuedSet[] {
  return queue.map((q) =>
    q.clientId === clientId
      ? { ...q, attempts: q.attempts + 1, lastError: message, lastAttemptAt: at }
      : q,
  );
}

/** Marks a set as refused for good: kept, not retried, shown to the athlete. */
export function markRejected(
  queue: readonly QueuedSet[],
  clientId: string,
  message: string,
  at: string,
): QueuedSet[] {
  return queue.map((q) =>
    q.clientId === clientId
      ? { ...q, attempts: q.attempts + 1, lastError: message, lastAttemptAt: at, rejected: true }
      : q,
  );
}

/**
 * Backoff before the next attempt, in milliseconds.
 *
 * Capped at a minute: a gym outage lasts the whole session, and doubling past a
 * minute only means the first set sits unsent long after signal returns. The
 * cap is what makes the queue drain promptly when the athlete walks outside.
 */
export function backoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(1000 * 2 ** (attempts - 1), 60_000);
}

/**
 * Entries whose backoff has elapsed, oldest first.
 *
 * Two deliberate leniencies, both erring towards sending:
 *
 *   - an unparseable timestamp counts as due. A corrupt field must not strand a
 *     set forever; sending it is safe because the write is idempotent.
 *   - a NEGATIVE elapsed time counts as due. That happens when the device clock
 *     moves backwards -- a timezone fix, an NTP correction, a user changing the
 *     date. Treating it as "not yet due" would park the set until the clock
 *     caught up, which for a manual change could be never.
 */
export function dueEntries(queue: readonly QueuedSet[], now: number): QueuedSet[] {
  return queue
    .filter((q) => {
      // A refused set is waiting for the athlete, not for the network.
      if (q.rejected === true) return false;
      if (q.attempts === 0) return true;
      const since = Date.parse(q.lastAttemptAt ?? q.queuedAt);
      if (Number.isNaN(since)) return true;
      const elapsed = now - since;
      if (elapsed < 0) return true;
      return elapsed >= backoffMs(q.attempts);
    })
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.setNumber - b.setNumber);
}

/**
 * Parses persisted state, tolerating anything.
 *
 * A queue that throws on a corrupt file would take the whole training screen
 * down with it -- and the file is only corrupt because the process died
 * mid-write, which is precisely when the athlete most needs the app to open.
 * Unreadable state is dropped, not fatal.
 */
export function parseQueue(raw: string | null): QueuedSet[] {
  if (raw === null || raw.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedSet).slice(0, MAX_QUEUE_LENGTH);
  } catch {
    return [];
  }
}

function isQueuedSet(value: unknown): value is QueuedSet {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.clientId === "string" &&
    typeof v.sessionLogId === "string" &&
    typeof v.exerciseId === "string" &&
    typeof v.setNumber === "number" &&
    typeof v.queuedAt === "string" &&
    typeof v.attempts === "number"
  );
}

// ── Runtime ─────────────────────────────────────────────────────────────────

export type SendResult = { ok: true } | { ok: false; message: string; retryable: boolean };

export type SetSender = (entry: QueuedSet) => Promise<SendResult>;

/**
 * Owns the in-memory queue, mirrors it to storage, and drains it.
 *
 * Deliberately not a React hook: the queue must keep draining while the screen
 * that created it is unmounted -- an athlete who navigates away mid-session
 * should still have their sets land.
 */
export class SetQueue {
  private queue: QueuedSet[];
  private inFlight: Promise<void> | null = null;
  private rerun = false;
  /**
   * Whether the on-disk queue has been read yet.
   *
   * Until it has, nothing is written back. Persisting before the read completes
   * would overwrite the PREVIOUS run's queue with whatever this run has so far,
   * which for a set validated in the first moments after opening the screen
   * means silently destroying every set the last session was still holding.
   */
  private restored = false;
  private listeners = new Set<(queue: readonly QueuedSet[]) => void>();

  constructor(
    private readonly storage: QueueStorage,
    private readonly send: SetSender,
    private readonly now: () => number = Date.now,
  ) {
    // Starts empty. Loading is `restore()`, because reading the file is async
    // and a constructor cannot await. Sets added before restore() resolves are
    // NOT lost -- see the merge rule there.
    this.queue = [];
  }

  /**
   * Loads whatever a previous run left behind.
   *
   * Merges rather than replaces. A set validated between construction and the
   * end of this read would otherwise be overwritten by the older on-disk state,
   * which is the exact failure this queue exists to prevent. Entries already
   * present in memory win, since they are the newer of the two.
   */
  async restore(): Promise<void> {
    let raw: string | null = null;
    try {
      raw = await this.storage.read();
    } catch {
      // An unreadable file means starting empty, never crashing the screen.
      // Persistence is still enabled afterwards: a read that failed once must
      // not disable writing for the rest of the session.
      this.restored = true;
      this.persist();
      return;
    }

    const persisted = parseQueue(raw);
    const live = new Set(this.queue.map((q) => q.clientId));
    const merged = [...persisted.filter((q) => !live.has(q.clientId)), ...this.queue];

    this.queue = merged.slice(-MAX_QUEUE_LENGTH);
    this.restored = true;
    this.persist();
    void this.drain();
  }

  /** Every set not yet on the server, including the ones it refused. */
  get pending(): readonly QueuedSet[] {
    return this.queue;
  }

  /** Sets the server refused for good. They stay until corrected or discarded. */
  get rejected(): readonly QueuedSet[] {
    return this.queue.filter((q) => q.rejected === true);
  }

  /** Removes the refused sets, once the athlete has chosen to let them go. */
  discardRejected(): void {
    this.queue = this.queue.filter((q) => q.rejected !== true);
    this.persist();
  }

  subscribe(listener: (queue: readonly QueuedSet[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Adds a set and starts a drain. Persisted before returning. */
  add(entry: QueuedSet): void {
    this.queue = enqueue(this.queue, entry);
    this.persist();
    void this.drain();
  }

  /**
   * Sends what is due, one entry at a time, and resolves once the queue is
   * quiescent.
   *
   * Concurrent callers share the in-flight promise rather than being dropped.
   * An earlier version returned immediately when a drain was already running,
   * which made "flush, then tell me whether everything landed" impossible to
   * express -- the caller got a resolved promise while the work was still going.
   * Since `add()` starts a drain in the background, that race was the normal
   * case, not an edge one.
   *
   * The rerun flag exists because sets added DURING a pass would otherwise be
   * stranded until the next `add()`: the loop repeats while new work arrived.
   *
   * Sequential rather than parallel: the sets of one session are naturally
   * ordered, a phone on a weak signal does worse with concurrent requests than
   * with one at a time, and a serial drain makes the failure handling trivial to
   * reason about.
   */
  drain(): Promise<void> {
    if (this.inFlight) {
      this.rerun = true;
      return this.inFlight;
    }

    this.inFlight = (async () => {
      try {
        do {
          this.rerun = false;
          await this.runPass();
        } while (this.rerun);
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }

  private async runPass(): Promise<void> {
    for (const entry of dueEntries(this.queue, this.now())) {
      // The entry may have been replaced by a correction while awaiting.
      const current = this.queue.find((q) => q.clientId === entry.clientId);
      if (!current) continue;

      const result = await this.attemptSend(current);
      if (result.ok) {
        this.queue = removeById(this.queue, current.clientId);
      } else if (result.retryable) {
        this.queue = markFailed(
          this.queue,
          current.clientId,
          result.message,
          new Date(this.now()).toISOString(),
        );
      } else {
        // A rejection the server will never accept -- a malformed value, or a
        // session that no longer exists. Retrying forever would block every
        // set behind it, so it stops being retried; but it is KEPT and marked,
        // never dropped, so the athlete is told and decides what happens to it.
        this.queue = markRejected(
          this.queue,
          current.clientId,
          result.message,
          new Date(this.now()).toISOString(),
        );
      }
      this.persist();
    }
  }

  /**
   * A sender that throws instead of returning a result is the common case, not
   * the exception: fetch rejects on a dropped connection. Treating a thrown
   * error as retryable is what keeps a dropped request in the queue rather than
   * turning it into an unhandled rejection from the background drain.
   */
  private async attemptSend(entry: QueuedSet): Promise<SendResult> {
    try {
      return await this.send(entry);
    } catch (cause) {
      return {
        ok: false,
        message: cause instanceof Error ? cause.message : String(cause),
        retryable: true,
      };
    }
  }

  private persist(): void {
    // Listeners always hear about the change; only the WRITE waits for restore.
    if (!this.restored) {
      for (const listener of this.listeners) listener(this.queue);
      return;
    }
    try {
      this.storage.write(JSON.stringify(this.queue));
    } catch {
      // A failed write must not take down the session. The queue still lives in
      // memory and will be retried on the next mutation; only a process kill
      // during a storage outage loses it.
    }
    for (const listener of this.listeners) listener(this.queue);
  }
}

/** In-memory storage, for tests and for platforms with no file system. */
export function createMemoryStorage(): QueueStorage {
  let value: string | null = null;
  return {
    read: () => Promise.resolve(value),
    write: (next) => {
      value = next;
    },
  };
}
