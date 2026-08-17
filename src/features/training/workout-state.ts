// ============================================================================
// State model of a session in progress (cm#25)
//
// A pure reducer: no React, no Supabase, no clock of its own. Every action that
// needs a timestamp is given one. That is what makes the rules below testable
// without rendering anything, and it is where the rules actually live -- the
// screen only renders this state and dispatches into it.
//
// WHAT IS LOCAL AND WHAT IS PERSISTED
//   * `draft` is purely local. It is what the athlete is dialling in with the
//     +/- buttons and has no meaning until they validate.
//   * `logged` is the local truth of the session. A set lands here the instant
//     it is validated, so the UI updates without waiting for the network.
//   * The queue (src/services/set-queue.ts) carries each logged set to the
//     server. The two are deliberately separate: the athlete's view of their
//     own session must never depend on connectivity.
// ============================================================================

/** One exercise as prescribed, plus what the athlete last did on it. */
export type WorkoutExercise = {
  sessionExerciseId: string;
  exerciseId: string;
  name: string;
  /** `session_exercises.sets`, defaulted to 1 when the prescription omits it. */
  targetSets: number;
  /** `session_exercises.reps` -- TEXT, so "8-12" and "AMRAP" are both valid. */
  targetReps: string | null;
  restSeconds: number | null;
  /** Heaviest set of the last completed session containing this exercise. */
  lastWeightKg: number | null;
  lastReps: number | null;
};

export type LoggedSet = {
  exerciseId: string;
  sessionExerciseId: string | null;
  setNumber: number;
  repsCompleted: number;
  weightKg: number | null;
  rpe: number | null;
  loggedAt: string;
};

export type WorkoutState = {
  sessionLogId: string;
  sessionId: string;
  exercises: WorkoutExercise[];
  currentIndex: number;
  /** What the +/- controls are currently showing. */
  draft: { reps: number; weightKg: number | null };
  /**
   * Flat list rather than a map keyed by exercise id: a flat array needs no
   * dynamic object indexing, which keeps the reducer free of the injection
   * hazard that comes with building objects from ids.
   */
  logged: LoggedSet[];
};

export type WorkoutAction =
  | { type: "adjust-reps"; delta: number }
  | { type: "set-reps"; value: number }
  | { type: "adjust-weight"; delta: number }
  | { type: "set-weight"; value: number | null }
  | { type: "validate-set"; at: string }
  | { type: "undo-last-set" }
  | { type: "go-to-exercise"; index: number }
  | { type: "next-exercise" }
  | { type: "previous-exercise" }
  /** Rehydrate from what the server already holds, when resuming a session. */
  | { type: "restore"; logged: LoggedSet[] };

/** Smallest plate pair on a barbell, which is what makes 2.5 the useful step. */
export const WEIGHT_STEP_KG = 2.5;

/**
 * Lower bound of a prescription like "8-12".
 *
 * `session_exercises.reps` is TEXT and real templates put ranges and words in
 * it. Seeding the counter at the low end of the range is deliberate: the athlete
 * decrements far less often than they increment, and starting at 12 for a
 * "8-12" set means three taps to get to 8.
 */
export function parseTargetReps(target: string | null): number | null {
  if (target === null) return null;
  const match = /(\d+)/.exec(target);
  const captured = match?.[1];
  if (captured === undefined) return null;
  const value = Number(captured);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The values the counters open on for an exercise.
 *
 * Weight comes from the last session rather than from the prescription, because
 * `weight_suggestion` is free text ("70% 1RM") and the number the athlete
 * actually used last time is the better starting point. Reps come from the
 * prescription, since that is the target for today.
 */
export function seedDraft(exercise: WorkoutExercise | undefined): {
  reps: number;
  weightKg: number | null;
} {
  if (!exercise) return { reps: 0, weightKg: null };
  return {
    reps: parseTargetReps(exercise.targetReps) ?? exercise.lastReps ?? 8,
    weightKg: exercise.lastWeightKg,
  };
}

export function initialWorkoutState(args: {
  sessionLogId: string;
  sessionId: string;
  exercises: WorkoutExercise[];
  logged?: LoggedSet[];
}): WorkoutState {
  const logged = args.logged ?? [];
  // Resume on the first exercise that still has sets left, so an athlete
  // reopening a session lands where they stopped rather than at the top.
  const currentIndex = firstIncompleteIndex(args.exercises, logged);
  return {
    sessionLogId: args.sessionLogId,
    sessionId: args.sessionId,
    exercises: args.exercises,
    currentIndex,
    draft: seedDraft(args.exercises.at(currentIndex)),
    logged,
  };
}

function firstIncompleteIndex(
  exercises: readonly WorkoutExercise[],
  logged: readonly LoggedSet[],
): number {
  const index = exercises.findIndex(
    (e) => setsLoggedFor(logged, e.exerciseId).length < e.targetSets,
  );
  // Everything done: stay on the last exercise rather than on an index that
  // does not exist.
  return index === -1 ? Math.max(exercises.length - 1, 0) : index;
}

export function setsLoggedFor(logged: readonly LoggedSet[], exerciseId: string): LoggedSet[] {
  return logged
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => a.setNumber - b.setNumber);
}

export function currentExercise(state: WorkoutState): WorkoutExercise | undefined {
  // `.at()` rather than `[]`: it expresses the same lookup, makes the possible
  // `undefined` explicit, and keeps the security linter from reading a numeric
  // array index as an object-injection sink.
  return state.exercises.at(state.currentIndex);
}

/** 1-based number the next validated set will take. */
export function nextSetNumber(state: WorkoutState): number {
  const exercise = currentExercise(state);
  if (!exercise) return 1;
  const done = setsLoggedFor(state.logged, exercise.exerciseId);
  const highest = done.reduce((max, s) => Math.max(max, s.setNumber), 0);
  return highest + 1;
}

export function isExerciseComplete(state: WorkoutState, index: number): boolean {
  const exercise = state.exercises.at(index);
  if (!exercise) return false;
  return setsLoggedFor(state.logged, exercise.exerciseId).length >= exercise.targetSets;
}

export function totalTargetSets(state: WorkoutState): number {
  return state.exercises.reduce((sum, e) => sum + e.targetSets, 0);
}

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case "adjust-reps":
      // Never below zero: a set of -1 reps is not a thing, and clamping here
      // means no caller has to remember to.
      return {
        ...state,
        draft: { ...state.draft, reps: Math.max(0, state.draft.reps + action.delta) },
      };

    case "set-reps":
      return { ...state, draft: { ...state.draft, reps: Math.max(0, Math.trunc(action.value)) } };

    case "adjust-weight": {
      const current = state.draft.weightKg ?? 0;
      const next = Math.max(0, current + action.delta);
      // Rounded to a hundredth: repeated 2.5 steps on a float otherwise drift
      // into 77.50000000000001, which then reaches the database.
      return {
        ...state,
        draft: { ...state.draft, weightKg: Math.round(next * 100) / 100 },
      };
    }

    case "set-weight":
      return {
        ...state,
        draft: {
          ...state.draft,
          weightKg: action.value === null ? null : Math.max(0, action.value),
        },
      };

    case "validate-set": {
      const exercise = currentExercise(state);
      if (!exercise) return state;

      const entry: LoggedSet = {
        exerciseId: exercise.exerciseId,
        sessionExerciseId: exercise.sessionExerciseId,
        setNumber: nextSetNumber(state),
        repsCompleted: state.draft.reps,
        weightKg: state.draft.weightKg,
        rpe: null,
        loggedAt: action.at,
      };

      // The draft is NOT reset. An athlete doing four sets at the same weight
      // should tap "Serie terminee" four times without re-dialling anything --
      // that is the three-seconds-per-set requirement.
      return { ...state, logged: [...state.logged, entry] };
    }

    case "undo-last-set": {
      const exercise = currentExercise(state);
      if (!exercise) return state;
      const done = setsLoggedFor(state.logged, exercise.exerciseId);
      const last = done[done.length - 1];
      if (!last) return state;
      return {
        ...state,
        logged: state.logged.filter(
          (s) => !(s.exerciseId === last.exerciseId && s.setNumber === last.setNumber),
        ),
      };
    }

    case "go-to-exercise": {
      if (action.index < 0 || action.index >= state.exercises.length) return state;
      return {
        ...state,
        currentIndex: action.index,
        draft: seedDraft(state.exercises.at(action.index)),
      };
    }

    case "next-exercise":
      return workoutReducer(state, {
        type: "go-to-exercise",
        index: Math.min(state.currentIndex + 1, state.exercises.length - 1),
      });

    case "previous-exercise":
      return workoutReducer(state, {
        type: "go-to-exercise",
        index: Math.max(state.currentIndex - 1, 0),
      });

    case "restore": {
      // Server-side sets win over whatever is in memory: this runs when
      // resuming, and the server holds the sets that actually landed.
      const currentIndex = firstIncompleteIndex(state.exercises, action.logged);
      return {
        ...state,
        logged: action.logged,
        currentIndex,
        draft: seedDraft(state.exercises.at(currentIndex)),
      };
    }
  }
}
