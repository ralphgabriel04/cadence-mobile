import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import {
  initialWorkoutState,
  workoutReducer,
  type LoggedSet,
  type WorkoutAction,
  type WorkoutExercise,
  type WorkoutState,
} from "@/features/training/workout-state";
import { createQueueStorage } from "@/services/queue-storage";
import { SetQueue, type QueuedSet } from "@/services/set-queue";
import {
  completeSession,
  loadInProgressSession,
  sendSet,
  startSession,
} from "@/services/workout-session";

export type WorkoutSessionStatus =
  | { status: "starting" }
  | { status: "ready" }
  | { status: "finishing" }
  | { status: "finished" }
  | { status: "error"; message: string };

/**
 * Drives a session in progress: opens it, feeds validated sets into the durable
 * queue, and closes it.
 *
 * The queue lives in a ref, not in state. It must survive re-renders and keep
 * draining while this hook's screen is unmounted -- an athlete who navigates
 * away mid-session should still have their sets land.
 */
export function useWorkoutSession(args: {
  sessionId: string;
  athleteId: string;
  exercises: WorkoutExercise[];
  programAssignmentId?: string | null;
}) {
  const { sessionId, athleteId, exercises, programAssignmentId } = args;

  const [state, dispatch] = useReducer(
    workoutReducer,
    { sessionLogId: "", sessionId, exercises },
    initialWorkoutState,
  );
  const [status, setStatus] = useState<WorkoutSessionStatus>({ status: "starting" });
  const [pending, setPending] = useState<readonly QueuedSet[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const queueRef = useRef<SetQueue | null>(null);
  const mounted = useRef(true);
  // Held in a ref rather than reducer state: the reducer is pure, and the id is
  // assigned by the server well after the initial state was constructed.
  // Declared here, with the other refs, so nothing below reads it before it
  // exists.
  const sessionLogIdRef = useRef<string>("");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Created once. Rebuilding it would drop whatever it is still holding.
  if (queueRef.current === null) {
    queueRef.current = new SetQueue(createQueueStorage(), (entry) => sendSet(entry));
  }
  const queue = queueRef.current;

  useEffect(() => {
    const unsubscribe = queue.subscribe((q) => {
      if (mounted.current) setPending([...q]);
    });
    // Anything left from a previous run goes out as soon as the screen opens.
    void queue.drain();
    return unsubscribe;
  }, [queue]);

  // Open or resume, then rehydrate from what the server already holds.
  useEffect(() => {
    let cancelled = false;

    async function begin() {
      const started = await startSession({ sessionId, athleteId, programAssignmentId });
      if (cancelled || !mounted.current) return;

      if (!started.ok) {
        setStatus({ status: "error", message: started.message });
        return;
      }

      const loaded = await loadInProgressSession();
      if (cancelled || !mounted.current) return;

      if (loaded.ok && loaded.sessionLogId !== null) {
        setStartedAt(loaded.startedAt);
        dispatch({ type: "restore", logged: loaded.logged });
      }

      setStatus({ status: "ready" });
      sessionLogIdRef.current = started.sessionLogId;
    }

    void begin();
    return () => {
      cancelled = true;
    };
  }, [sessionId, athleteId, programAssignmentId]);

  /**
   * Validates the drafted set: into local state first, then into the queue.
   *
   * The order matters. The athlete sees the set land immediately; the network is
   * the queue's problem. Reversing it would make the UI wait on connectivity,
   * which is the one thing a gym cannot supply.
   */
  const validateSet = useCallback(() => {
    const at = new Date().toISOString();
    const exercise = state.exercises.at(state.currentIndex);
    if (!exercise) return;

    const setNumber =
      state.logged.filter((l) => l.exerciseId === exercise.exerciseId).length + 1;

    dispatch({ type: "validate-set", at });

    queue.add({
      clientId: `${sessionLogIdRef.current}:${exercise.exerciseId}:${setNumber}:${at}`,
      sessionLogId: sessionLogIdRef.current,
      exerciseId: exercise.exerciseId,
      sessionExerciseId: exercise.sessionExerciseId,
      setNumber,
      repsCompleted: state.draft.reps,
      weightKg: state.draft.weightKg,
      rpe: null,
      durationSeconds: null,
      distanceMeters: null,
      notes: null,
      queuedAt: at,
      lastAttemptAt: null,
      attempts: 0,
      lastError: null,
    });
  }, [queue, state.currentIndex, state.draft, state.exercises, state.logged]);

  /**
   * Closes the session, but only after the queue has drained.
   *
   * Finishing while sets are still queued would mark the session complete with
   * a volume the athlete did not actually record. The drain is awaited; if it
   * cannot complete the caller is told rather than the session being closed on
   * incomplete data.
   */
  const finish = useCallback(
    async (options?: { overallRpe?: number | null; notes?: string | null }) => {
      setStatus({ status: "finishing" });
      await queue.drain();

      if (queue.pending.length > 0) {
        setStatus({
          status: "error",
          message: `${queue.pending.length} série(s) pas encore envoyée(s). Reste connecté un instant.`,
        });
        return false;
      }

      const completedAt = new Date().toISOString();
      const durationMinutes =
        startedAt === null
          ? null
          : Math.max(
              0,
              Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 60_000),
            );

      const result = await completeSession({
        sessionLogId: sessionLogIdRef.current,
        completedAt,
        durationMinutes,
        overallRpe: options?.overallRpe ?? null,
        notes: options?.notes ?? null,
      });

      if (!mounted.current) return false;

      if (!result.ok) {
        setStatus({ status: "error", message: result.message });
        return false;
      }

      setStatus({ status: "finished" });
      return true;
    },
    [queue, startedAt],
  );

  const act = useCallback((action: WorkoutAction) => dispatch(action), []);

  return useMemo(
    () => ({
      state: state as WorkoutState,
      status,
      /** Sets still waiting to reach the server. Drives the "hors ligne" hint. */
      pendingCount: pending.length,
      startedAt,
      dispatch: act,
      validateSet,
      finish,
      retryPending: () => void queue.drain(),
    }),
    [state, status, pending.length, startedAt, act, validateSet, finish, queue],
  );
}

export type { LoggedSet, WorkoutExercise };
