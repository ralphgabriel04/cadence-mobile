import { createQueueStorage } from "./queue-storage";
import { mayRestoreLocalQueue } from "./purge-local-queue";
import { activeSessionStore, type ActiveSession, type ActiveSessionStore } from "./active-session";
import { SetQueue } from "./set-queue";
import { todayCache } from "./today-cache";
import { completeSession, ensureSessionLog, sendSet } from "./workout-session";

// ============================================================================
// One set queue per signed-in account, shared by the live session and the home
// screen (story 5.3).
//
// Two queues on the same file would overwrite each other's writes; a single
// instance per account removes that race. The live session adds sets to it,
// and the home screen drains it -- with the completion of a session finished
// without network (story 5.5, criterion 5) -- as soon as the app is opened
// with network again.
// ============================================================================

let current: SetQueue | null = null;
let currentOwner = "";
let restoring: Promise<void> | null = null;

/** The account's queue, created on first use (and again after account deletion closed it). */
export function getSetQueue(athleteId: string): SetQueue {
  if (!current || current.isClosed || currentOwner !== athleteId) {
    current = new SetQueue(createQueueStorage(), (entry) => sendSet(entry), Date.now, athleteId);
    currentOwner = athleteId;
    restoring = null;
  }
  return current;
}

/**
 * Reads what a previous run left on disk, once per queue, then drains it.
 * After a refused purge (deleted account, file still there) nothing is
 * reloaded or sent (see purge-local-queue.ts).
 */
export function restoreSetQueue(queue: SetQueue): Promise<void> {
  if (queue.isRestored) return Promise.resolve();
  if (queue === current && restoring) return restoring;
  const run = mayRestoreLocalQueue().then((ok) => (ok ? queue.restore() : undefined));
  if (queue === current) restoring = run;
  return run;
}

export type FlushResult =
  | { status: "nothing" }
  | { status: "sent" }
  | { status: "waiting"; pendingSets: number }
  | { status: "failed"; message: string };

/**
 * Sends a completion that could not be sent when the athlete finished
 * (story 5.5, criterion 5). Only once every set of that session is on the
 * server: closing it earlier would record a smaller volume than was done.
 */
export async function flushPendingCompletion(
  athleteId: string,
  deps: {
    store?: ActiveSessionStore;
    queue?: SetQueue;
    complete?: typeof completeSession;
    ensure?: typeof ensureSessionLog;
    /**
     * The finished session to send, when the caller already holds it: the live
     * session passes the previous record before writing the new one over it.
     */
    record?: ActiveSession;
  } = {}
): Promise<FlushResult> {
  if (!athleteId) return { status: "nothing" };
  const store = deps.store ?? activeSessionStore();
  const record = deps.record ?? (await store.read(athleteId));
  if (!record?.completion) return { status: "nothing" };

  const queue = deps.queue ?? getSetQueue(athleteId);
  if (!deps.queue) await restoreSetQueue(queue);
  await queue.drain();
  const left = queue.pending.filter((q) => q.sessionLogId === record.sessionLogId).length;
  if (left > 0) return { status: "waiting", pendingSets: left };

  const ensured = await (deps.ensure ?? ensureSessionLog)({
    sessionLogId: record.sessionLogId,
    sessionId: record.sessionId,
    athleteId,
    startedAt: record.startedAt,
    programAssignmentId: record.programAssignmentId,
  });
  if (!ensured.ok) return { status: "failed", message: ensured.message };

  const done = await (deps.complete ?? completeSession)({
    sessionLogId: record.sessionLogId,
    ...record.completion,
  });
  if (!done.ok) return { status: "failed", message: done.message };

  // Only erase the record that was sent: a new session may have replaced it
  // in the meantime, and its record must survive.
  const now = await store.read(athleteId);
  if (now?.sessionLogId === record.sessionLogId) store.erase();
  return { status: "sent" };
}

/**
 * Story 5.5, criterion 4, without network: the kept home screen shows the
 * session as « Faite » until the server says so itself.
 */
export async function markTodayDoneLocally(record: ActiveSession): Promise<void> {
  try {
    const cache = todayCache();
    const cached = await cache.read(record.athleteId);
    if (!cached || !record.completion) return;
    const today = cached.data.today;
    if (
      (today.state === "scheduled" || today.state === "in-progress") &&
      today.session.sessionId === record.sessionId
    ) {
      const days = cached.data.week.days.map((d) =>
        d.isToday ? { ...d, state: "completed" as const } : d
      );
      cache.save(
        record.athleteId,
        {
          ...cached.data,
          today: {
            state: "completed",
            session: today.session,
            log: {
              sessionLogId: record.sessionLogId,
              startedAt: record.startedAt,
              status: "completed",
              loggedSetCount: record.logged.length,
              completedAt: record.completion.completedAt,
              durationMinutes: record.completion.durationMinutes,
              overallRpe: record.completion.overallRpe,
              notes: record.completion.notes,
            },
          },
          week: {
            ...cached.data.week,
            days,
            completedCount: days.filter((d) => d.state === "completed").length,
          },
        },
        cached.savedAt
      );
    }
  } catch {
    // The cache is a convenience; the server stays the truth.
  }
}

/** Tests only: forget the shared queue so each test starts from its own disk. */
export function resetSharedSetQueueForTests(): void {
  current = null;
  currentOwner = "";
  restoring = null;
}
