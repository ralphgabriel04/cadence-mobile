import {
  averageRpe,
  setsLoggedFor,
  totalTargetSets,
  volumeKg,
  type LoggedSet,
  type WorkoutState,
} from "./workout-state";

// ============================================================================
// Figures of the end-of-session recap (story 5.5) and of the summary shown
// between two exercises (wireframe session-live/musculation, screens 3 and 4).
// Pure: tested without rendering.
// ============================================================================

export type ExerciseRecap = {
  exerciseId: string;
  name: string;
  sets: LoggedSet[];
  volumeKg: number;
  averageRpe: number | null;
  averageReps: number | null;
};

export type SessionRecap = {
  durationSeconds: number;
  setsDone: number;
  setsPlanned: number;
  volumeKg: number;
  exercises: ExerciseRecap[];
};

export function exerciseRecap(state: WorkoutState, index: number): ExerciseRecap | null {
  const exercise = state.exercises.at(index);
  if (!exercise) return null;
  const sets = setsLoggedFor(state.logged, exercise.exerciseId);
  return {
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    sets,
    volumeKg: volumeKg(sets),
    averageRpe: averageRpe(sets),
    averageReps:
      sets.length === 0
        ? null
        : Math.round((sets.reduce((s, x) => s + x.repsCompleted, 0) / sets.length) * 10) / 10,
  };
}

export function sessionRecap(
  state: WorkoutState,
  startedAt: string | null,
  now: number
): SessionRecap {
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  return {
    durationSeconds: Number.isNaN(started) ? 0 : Math.max(0, Math.floor((now - started) / 1000)),
    setsDone: state.logged.length,
    setsPlanned: totalTargetSets(state),
    volumeKg: volumeKg(state.logged),
    exercises: state.exercises
      .map((_e, i) => exerciseRecap(state, i))
      .filter((r): r is ExerciseRecap => r !== null && r.sets.length > 0),
  };
}

/** « 38:12 », or « 1:05:09 » past an hour. */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** « 1 500 » with a thin space, the way the wireframe writes kilos. */
export function formatKg(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const [int = "0", dec] = String(rounded).split(".");
  // Groups of three from the right, without a backtracking regular expression.
  let grouped = "";
  for (let k = 0; k < int.length; k++) {
    if (k > 0 && (int.length - k) % 3 === 0) grouped += "\u202f";
    grouped += int.charAt(k);
  }
  return dec ? `${grouped},${dec}` : grouped;
}

/** « 52,5 » — French decimal comma for a weight. */
export function formatWeight(kg: number): string {
  return formatKg(kg);
}
