import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import {
  draftProblem,
  initialWorkoutState,
  workoutReducer,
  type LoggedSet,
  type WorkoutAction,
  type WorkoutExercise,
  type WorkoutState,
} from "@/features/training/workout-state";
import {
  activeSessionStore,
  mergeLogged,
  newUuid,
  type ActiveSession,
  type ActiveSessionStore,
  type PendingCompletion,
} from "@/services/active-session";
import type { QueuedSet, SetQueue } from "@/services/set-queue";
import {
  flushPendingCompletion,
  getSetQueue,
  markTodayDoneLocally,
  restoreSetQueue,
} from "@/services/training-sync";
import { loadInProgressSession, startSession } from "@/services/workout-session";

export type WorkoutSessionStatus =
  | { status: "starting" }
  | { status: "ready" }
  | { status: "finishing" }
  /** `queued`: saved on the phone, sent as soon as the network is back (story 5.5). */
  | { status: "finished"; queued: boolean }
  | { status: "error"; message: string };

export type ValidateResult = { ok: true; set: LoggedSet } | { ok: false; message: string };

/**
 * Drives a session in progress (epic 5).
 *
 * OFFLINE FIRST (story 5.3). The session opens on the phone: the log id is
 * chosen here, the record of the session is written to the phone before any
 * request, and the screen is usable at once. The server is told in the
 * background; if there is no network, the first set to get through creates the
 * log. Every validated set goes to the phone's record and to the shared,
 * durable queue. Nothing waits on the network.
 */
export function useWorkoutSession(args: {
  sessionId: string;
  athleteId: string;
  exercises: WorkoutExercise[];
  programAssignmentId?: string | null;
  /** Injectable for tests. */
  store?: ActiveSessionStore;
  queue?: SetQueue;
}) {
  const { sessionId, athleteId, exercises, programAssignmentId = null } = args;

  const [state, dispatch] = useReducer(
    workoutReducer,
    { sessionLogId: "", sessionId, exercises },
    initialWorkoutState
  );
  const [status, setStatus] = useState<WorkoutSessionStatus>({ status: "starting" });
  const [pending, setPending] = useState<readonly QueuedSet[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  /** True when the server could not be reached at start (shown as « Hors ligne »). */
  const [offline, setOffline] = useState(false);

  const mounted = useRef(true);
  const storeRef = useRef(args.store ?? activeSessionStore());
  const queueRef = useRef<SetQueue>(args.queue ?? getSetQueue(athleteId));
  const recordRef = useRef<ActiveSession | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const queue = queueRef.current;

  useEffect(() => {
    const unsubscribe = queue.subscribe((q) => {
      if (mounted.current) setPending([...q]);
    });
    void restoreSetQueue(queue);
    return unsubscribe;
  }, [queue]);

  const saveRecord = useCallback((patch: Partial<ActiveSession>) => {
    const record = recordRef.current;
    if (!record) return;
    recordRef.current = { ...record, ...patch };
    try {
      storeRef.current.write(recordRef.current);
    } catch {
      // The queue still holds every unsent set; only the screen's resume suffers.
    }
  }, []);

  // ── Open: phone first, server in the background ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function begin() {
      const store = storeRef.current;
      let record = await store.read(athleteId).catch(() => null);
      if (cancelled || !mounted.current) return;

      if (!record || record.sessionId !== sessionId || record.completion) {
        // A finished-but-unsent previous session keeps its own record until it
        // is sent; this one starts fresh.
        if (record?.completion) void flushPendingCompletion(athleteId).catch(() => undefined);
        record = {
          athleteId,
          sessionId,
          sessionLogId: newUuid(),
          startedAt: new Date().toISOString(),
          programAssignmentId,
          logged: [],
          completion: null,
        };
      }
      recordRef.current = record;
      try {
        store.write(record);
      } catch {
        // see saveRecord
      }

      setStartedAt(record.startedAt);
      if (record.logged.length > 0) dispatch({ type: "restore", logged: record.logged });
      setStatus({ status: "ready" });

      // Tell the server. A session already open there (same session, nothing
      // logged on the phone yet) is adopted so its sets come back.
      const started = await startSession({
        sessionId,
        athleteId,
        programAssignmentId,
        sessionLogId: record.sessionLogId,
        startedAt: record.startedAt,
      }).catch((e: unknown) => ({
        ok: false as const,
        kind: "network" as const,
        message: e instanceof Error ? e.message : String(e),
      }));
      if (cancelled || !mounted.current) return;

      if (!started.ok) {
        setOffline(started.kind === "network");
        return;
      }
      setOffline(false);

      // startSession only hands back another id when the server already has
      // THIS session open (opened on another launch). Adopt it while nothing is
      // noted on the phone, so its sets come back; otherwise keep ours.
      if (started.sessionLogId !== record.sessionLogId && record.logged.length === 0) {
        saveRecord({ sessionLogId: started.sessionLogId });
      }

      const loaded = await loadInProgressSession({ athleteId }).catch(() => null);
      if (cancelled || !mounted.current || !loaded?.ok || loaded.sessionLogId === null) return;
      const current = recordRef.current;
      if (!current || loaded.sessionLogId !== current.sessionLogId) return;

      const logged = mergeLogged(loaded.logged, current.logged);
      if (loaded.startedAt) {
        setStartedAt(loaded.startedAt);
        saveRecord({ startedAt: loaded.startedAt, logged });
      } else {
        saveRecord({ logged });
      }
      dispatch({ type: "restore", logged });
    }

    void begin();
    return () => {
      cancelled = true;
    };
  }, [sessionId, athleteId, programAssignmentId, saveRecord]);

  const enqueue = useCallback(
    (set: LoggedSet) => {
      const record = recordRef.current;
      if (!record) return;
      queue.add({
        clientId: `${record.sessionLogId}:${set.exerciseId}:${set.setNumber}:${set.loggedAt}`,
        sessionLogId: record.sessionLogId,
        exerciseId: set.exerciseId,
        sessionExerciseId: set.sessionExerciseId,
        setNumber: set.setNumber,
        repsCompleted: set.repsCompleted,
        weightKg: set.weightKg,
        rpe: set.rpe,
        durationSeconds: null,
        distanceMeters: null,
        notes: null,
        queuedAt: new Date().toISOString(),
        lastAttemptAt: null,
        attempts: 0,
        lastError: null,
        sessionId: record.sessionId,
        sessionStartedAt: record.startedAt,
        programAssignmentId: record.programAssignmentId,
      });
    },
    [queue]
  );

  /**
   * Validates the drafted set (story 5.2): refused with the reason when the
   * value is not plausible; otherwise on screen at once, on the phone, then
   * in the queue. The order matters: the network is the queue's problem.
   */
  const validateSet = useCallback((): ValidateResult => {
    const current = stateRef.current;
    const problem = draftProblem(current.draft);
    if (problem) return { ok: false, message: problem };
    if (!recordRef.current) return { ok: false, message: "La séance s'ouvre encore. Réessaie." };

    const at = new Date().toISOString();
    const next = workoutReducer(current, { type: "validate-set", at });
    const set = next.logged.at(-1);
    if (!set || next.logged.length === current.logged.length) {
      return { ok: false, message: "Aucun exercice en cours." };
    }
    stateRef.current = next;
    dispatch({ type: "validate-set", at });
    saveRecord({ logged: next.logged });
    enqueue(set);
    return { ok: true, set };
  }, [enqueue, saveRecord]);

  /** Story 5.6: effort felt on one set, changed or cleared at any time. */
  const setRpe = useCallback(
    (exerciseId: string, setNumber: number, rpe: number | null) => {
      const action: WorkoutAction = { type: "set-rpe", exerciseId, setNumber, rpe };
      const next = workoutReducer(stateRef.current, action);
      stateRef.current = next;
      dispatch(action);
      saveRecord({ logged: next.logged });
      const set = next.logged.find((l) => l.exerciseId === exerciseId && l.setNumber === setNumber);
      // Same slot: replaces an unsent copy, or updates the row already sent.
      if (set) enqueue(set);
    },
    [enqueue, saveRecord]
  );

  /**
   * Ends the session (story 5.5). The summary never waits for the network:
   * the completion is written to the phone first, then sent once every set of
   * the session is on the server -- now if possible, otherwise as soon as the
   * app has network again (the home screen flushes it).
   */
  const finish = useCallback(
    async (options?: { overallRpe?: number | null; notes?: string | null }) => {
      const record = recordRef.current;
      if (!record) return false;
      setStatus({ status: "finishing" });

      const completedAt = new Date().toISOString();
      const completion: PendingCompletion = {
        completedAt,
        durationMinutes: Math.max(
          0,
          Math.round((Date.parse(completedAt) - Date.parse(record.startedAt)) / 60_000)
        ),
        overallRpe: options?.overallRpe ?? null,
        notes: options?.notes ?? null,
      };
      saveRecord({ completion });
      const saved = recordRef.current;
      if (saved) await markTodayDoneLocally(saved);

      const result = await flushPendingCompletion(athleteId, {
        store: storeRef.current,
        queue,
      }).catch((e: unknown) => ({
        status: "failed" as const,
        message: e instanceof Error ? e.message : String(e),
      }));
      if (!mounted.current) return true;

      setStatus({ status: "finished", queued: result.status !== "sent" });
      return true;
    },
    [athleteId, queue, saveRecord]
  );

  const act = useCallback((action: WorkoutAction) => dispatch(action), []);

  return useMemo(
    () => ({
      state: state as WorkoutState,
      status,
      offline,
      /** Sets of this session still waiting to reach the server. */
      pendingCount: pending.filter((q) => q.rejected !== true).length,
      /** Sets the server refused for good: shown, never dropped silently. */
      rejectedCount: pending.filter((q) => q.rejected === true).length,
      discardRejected: () => queue.discardRejected(),
      startedAt,
      dispatch: act,
      validateSet,
      setRpe,
      finish,
      retryPending: () => void queue.drain(),
    }),
    [state, status, offline, pending, startedAt, act, validateSet, setRpe, finish, queue]
  );
}

export type { LoggedSet, WorkoutExercise };
