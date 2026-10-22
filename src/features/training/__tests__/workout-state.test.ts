import {
  currentExercise,
  initialWorkoutState,
  isExerciseComplete,
  nextSetNumber,
  parseTargetReps,
  seedDraft,
  setsLoggedFor,
  totalTargetSets,
  WEIGHT_STEP_KG,
  workoutReducer,
  type LoggedSet,
  type WorkoutAction,
  type WorkoutExercise,
  type WorkoutState,
} from "../workout-state";

function exercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
    sessionExerciseId: "se-1",
    exerciseId: "ex-1",
    name: "Squat barre",
    targetSets: 4,
    targetReps: "8-12",
    restSeconds: 90,
    lastWeightKg: 75,
    lastReps: 8,
    ...overrides,
  };
}

function stateWith(exercises: WorkoutExercise[], logged: LoggedSet[] = []): WorkoutState {
  return initialWorkoutState({
    sessionLogId: "sl-1",
    sessionId: "s-1",
    exercises,
    logged,
  });
}

function apply(state: WorkoutState, ...actions: WorkoutAction[]): WorkoutState {
  return actions.reduce(workoutReducer, state);
}

const AT = "2026-08-17T18:30:00.000Z";

// ── Seeding ──────────────────────────────────────────────────────────────────

describe("parseTargetReps", () => {
  it("takes the lower bound of a range", () => {
    // Starting at 12 for a "8-12" set means three taps down. The athlete
    // increments far more often than they decrement.
    expect(parseTargetReps("8-12")).toBe(8);
    expect(parseTargetReps("8 – 12")).toBe(8);
  });

  it("handles a single number", () => {
    expect(parseTargetReps("10")).toBe(10);
  });

  it("returns null for text with no number", () => {
    expect(parseTargetReps("AMRAP")).toBeNull();
    expect(parseTargetReps(null)).toBeNull();
    expect(parseTargetReps("")).toBeNull();
  });
});

describe("seedDraft", () => {
  it("opens on the prescription for reps and on last session's weight", () => {
    // weight_suggestion is free text ("70% 1RM"); the number the athlete
    // actually lifted last time is the useful starting point.
    expect(seedDraft(exercise())).toEqual({ reps: 8, weightKg: 75 });
  });

  it("falls back to the last logged reps when the target is not numeric", () => {
    expect(seedDraft(exercise({ targetReps: "AMRAP", lastReps: 12 }))).toEqual({
      reps: 12,
      weightKg: 75,
    });
  });

  it("falls back to 8 when nothing is known", () => {
    expect(seedDraft(exercise({ targetReps: null, lastReps: null, lastWeightKg: null }))).toEqual({
      reps: 8,
      weightKg: null,
    });
  });

  it("is safe on a missing exercise", () => {
    expect(seedDraft(undefined)).toEqual({ reps: 0, weightKg: null });
  });
});

// ── The counters ─────────────────────────────────────────────────────────────

describe("draft adjustments", () => {
  it("increments and decrements reps", () => {
    const s = apply(stateWith([exercise()]), { type: "adjust-reps", delta: 1 });
    expect(s.draft.reps).toBe(9);
  });

  it("never goes below zero reps", () => {
    const s = apply(stateWith([exercise()]), { type: "adjust-reps", delta: -20 });
    expect(s.draft.reps).toBe(0);
  });

  it("steps the weight by the plate increment without drifting", () => {
    // Repeated float additions of 2.5 otherwise produce 77.50000000000001,
    // which then reaches the database and shows up in the athlete's history.
    let s = stateWith([exercise({ lastWeightKg: 75 })]);
    for (let i = 0; i < 10; i++) {
      s = workoutReducer(s, { type: "adjust-weight", delta: WEIGHT_STEP_KG });
    }
    expect(s.draft.weightKg).toBe(100);

    for (let i = 0; i < 20; i++) {
      s = workoutReducer(s, { type: "adjust-weight", delta: -WEIGHT_STEP_KG });
    }
    expect(s.draft.weightKg).toBe(50);
  });

  it("never goes below zero weight", () => {
    const s = apply(stateWith([exercise({ lastWeightKg: 5 })]), {
      type: "adjust-weight",
      delta: -100,
    });
    expect(s.draft.weightKg).toBe(0);
  });

  it("allows clearing the weight for a bodyweight exercise", () => {
    const s = apply(stateWith([exercise()]), { type: "set-weight", value: null });
    expect(s.draft.weightKg).toBeNull();
  });
});

// ── Validating a set ─────────────────────────────────────────────────────────

describe("validate-set", () => {
  it("records the draft as the next set", () => {
    const s = apply(stateWith([exercise()]), { type: "validate-set", at: AT });

    expect(s.logged).toHaveLength(1);
    expect(s.logged[0]).toEqual({
      exerciseId: "ex-1",
      sessionExerciseId: "se-1",
      setNumber: 1,
      repsCompleted: 8,
      weightKg: 75,
      rpe: null,
      loggedAt: AT,
    });
  });

  it("keeps the draft so repeated sets are one tap each", () => {
    // The three-seconds-per-set requirement: four sets at the same weight must
    // not mean re-dialling the counters between each one.
    const s = apply(
      stateWith([exercise()]),
      { type: "validate-set", at: AT },
      { type: "validate-set", at: AT },
      { type: "validate-set", at: AT },
    );

    expect(s.logged.map((l) => l.setNumber)).toEqual([1, 2, 3]);
    expect(s.draft).toEqual({ reps: 8, weightKg: 75 });
  });

  it("numbers sets per exercise, not globally", () => {
    const s = apply(
      stateWith([exercise(), exercise({ exerciseId: "ex-2", sessionExerciseId: "se-2" })]),
      { type: "validate-set", at: AT },
      { type: "validate-set", at: AT },
      { type: "next-exercise" },
      { type: "validate-set", at: AT },
    );

    expect(setsLoggedFor(s.logged, "ex-1").map((l) => l.setNumber)).toEqual([1, 2]);
    expect(setsLoggedFor(s.logged, "ex-2").map((l) => l.setNumber)).toEqual([1]);
  });

  it("does nothing when there is no exercise", () => {
    const s = apply(stateWith([]), { type: "validate-set", at: AT });
    expect(s.logged).toHaveLength(0);
  });
});

describe("undo-last-set", () => {
  it("removes the most recent set of the current exercise", () => {
    const s = apply(
      stateWith([exercise()]),
      { type: "validate-set", at: AT },
      { type: "validate-set", at: AT },
      { type: "undo-last-set" },
    );

    expect(s.logged.map((l) => l.setNumber)).toEqual([1]);
  });

  it("frees the set number so the next validation reuses it", () => {
    // Otherwise a correction would leave a hole and the idempotency key of the
    // queue would point at a set number that no longer exists.
    const s = apply(
      stateWith([exercise()]),
      { type: "validate-set", at: AT },
      { type: "undo-last-set" },
      { type: "validate-set", at: AT },
    );

    expect(s.logged.map((l) => l.setNumber)).toEqual([1]);
  });

  it("does nothing when nothing has been logged", () => {
    const s = apply(stateWith([exercise()]), { type: "undo-last-set" });
    expect(s.logged).toHaveLength(0);
  });

  it("leaves another exercise's sets alone", () => {
    const s = apply(
      stateWith([exercise(), exercise({ exerciseId: "ex-2", sessionExerciseId: "se-2" })]),
      { type: "validate-set", at: AT },
      { type: "next-exercise" },
      { type: "validate-set", at: AT },
      { type: "undo-last-set" },
    );

    expect(setsLoggedFor(s.logged, "ex-1")).toHaveLength(1);
    expect(setsLoggedFor(s.logged, "ex-2")).toHaveLength(0);
  });
});

// ── Navigation ───────────────────────────────────────────────────────────────

describe("navigation", () => {
  const two = [exercise(), exercise({ exerciseId: "ex-2", sessionExerciseId: "se-2", lastWeightKg: 40 })];

  it("reseeds the draft for the exercise moved to", () => {
    const s = apply(stateWith(two), { type: "next-exercise" });
    expect(currentExercise(s)?.exerciseId).toBe("ex-2");
    expect(s.draft.weightKg).toBe(40);
  });

  it("clamps at both ends instead of wrapping", () => {
    const first = apply(stateWith(two), { type: "previous-exercise" });
    expect(first.currentIndex).toBe(0);

    const last = apply(stateWith(two), { type: "next-exercise" }, { type: "next-exercise" });
    expect(last.currentIndex).toBe(1);
  });

  it("ignores an out-of-range jump", () => {
    const s = apply(stateWith(two), { type: "go-to-exercise", index: 99 });
    expect(s.currentIndex).toBe(0);
  });
});

// ── Progress ─────────────────────────────────────────────────────────────────

describe("progress helpers", () => {
  it("counts the target sets of the whole session", () => {
    expect(
      totalTargetSets(stateWith([exercise({ targetSets: 4 }), exercise({ exerciseId: "ex-2", targetSets: 3 })])),
    ).toBe(7);
  });

  it("knows when an exercise is done", () => {
    let s = stateWith([exercise({ targetSets: 2 })]);
    expect(isExerciseComplete(s, 0)).toBe(false);

    s = apply(s, { type: "validate-set", at: AT }, { type: "validate-set", at: AT });
    expect(isExerciseComplete(s, 0)).toBe(true);
  });

  it("reports the next set number", () => {
    let s = stateWith([exercise()]);
    expect(nextSetNumber(s)).toBe(1);
    s = apply(s, { type: "validate-set", at: AT });
    expect(nextSetNumber(s)).toBe(2);
  });
});

// ── Resuming ─────────────────────────────────────────────────────────────────

describe("resuming an interrupted session", () => {
  const three = [
    exercise({ exerciseId: "ex-1", targetSets: 2 }),
    exercise({ exerciseId: "ex-2", sessionExerciseId: "se-2", targetSets: 2 }),
    exercise({ exerciseId: "ex-3", sessionExerciseId: "se-3", targetSets: 2 }),
  ];

  function logged(exerciseId: string, setNumber: number): LoggedSet {
    return {
      exerciseId,
      sessionExerciseId: null,
      setNumber,
      repsCompleted: 10,
      weightKg: 60,
      rpe: null,
      loggedAt: AT,
    };
  }

  it("opens on the first exercise that still has sets left", () => {
    const s = stateWith(three, [logged("ex-1", 1), logged("ex-1", 2), logged("ex-2", 1)]);
    expect(s.currentIndex).toBe(1);
    expect(nextSetNumber(s)).toBe(2);
  });

  it("stays on the last exercise when everything is done", () => {
    const all = three.flatMap((e) => [logged(e.exerciseId, 1), logged(e.exerciseId, 2)]);
    const s = stateWith(three, all);
    expect(s.currentIndex).toBe(2);
  });

  it("opens at the top when nothing has been logged", () => {
    expect(stateWith(three).currentIndex).toBe(0);
  });

  it("restore replaces local sets with the server's and repositions", () => {
    // The server holds the sets that actually landed; anything in memory that
    // disagrees is stale.
    const s = apply(
      stateWith(three),
      { type: "validate-set", at: AT },
      { type: "restore", logged: [logged("ex-1", 1), logged("ex-1", 2)] },
    );

    expect(s.logged).toHaveLength(2);
    expect(s.currentIndex).toBe(1);
  });
});
