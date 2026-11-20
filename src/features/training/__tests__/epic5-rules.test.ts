import { mergeLogged, newUuid, parseActiveSession } from "@/services/active-session";

import { formatElapsed, formatKg, sessionRecap } from "../session-recap";
import {
  draftProblem,
  initialWorkoutState,
  parsePrescribedWeight,
  remainingSets,
  volumeKg,
  workoutReducer,
  type LoggedSet,
  type WorkoutExercise,
} from "../workout-state";

const ex = (id: string, sets = 3): WorkoutExercise => ({
  sessionExerciseId: `se-${id}`,
  exerciseId: id,
  name: `Exercice ${id}`,
  targetSets: sets,
  targetReps: "10",
  restSeconds: 90,
  lastWeightKg: 50,
  lastReps: 10,
});

const set = (exerciseId: string, setNumber: number, over: Partial<LoggedSet> = {}): LoggedSet => ({
  exerciseId,
  sessionExerciseId: `se-${exerciseId}`,
  setNumber,
  repsCompleted: 10,
  weightKg: 50,
  rpe: null,
  loggedAt: `2026-08-17T18:0${setNumber}:00.000Z`,
  ...over,
});

describe("story 5.2 — noter une série", () => {
  it("validates a prefilled set in one action (50 kg × 10)", () => {
    const s = initialWorkoutState({ sessionLogId: "l", sessionId: "s", exercises: [ex("a")] });
    expect(s.draft).toEqual({ reps: 10, weightKg: 50 });
    const after = workoutReducer(s, { type: "validate-set", at: "2026-08-17T18:00:00Z" });
    expect(after.logged).toHaveLength(1);
    expect(after.logged[0]).toMatchObject({ repsCompleted: 10, weightKg: 50, setNumber: 1 });
  });

  it("first time on an exercise: prefills a prescribed weight written as a number, not « 70% 1RM »", () => {
    expect(parsePrescribedWeight("60 kg")).toBe(60);
    expect(parsePrescribedWeight("62,5")).toBe(62.5);
    expect(parsePrescribedWeight("70% 1RM")).toBeNull();
    expect(parsePrescribedWeight(null)).toBeNull();
    const first = { ...ex("a"), lastWeightKg: null, lastReps: null, prescribedWeightKg: 60 };
    const s = initialWorkoutState({ sessionLogId: "l", sessionId: "s", exercises: [first] });
    expect(s.draft).toEqual({ reps: 10, weightKg: 60 });
    // The weight actually used last time still wins.
    const again = initialWorkoutState({
      sessionLogId: "l",
      sessionId: "s",
      exercises: [{ ...ex("a"), prescribedWeightKg: 60 }],
    });
    expect(again.draft.weightKg).toBe(50);
  });

  it("one + takes 50 to 52.5", () => {
    const s = initialWorkoutState({ sessionLogId: "l", sessionId: "s", exercises: [ex("a")] });
    expect(workoutReducer(s, { type: "adjust-weight", delta: 2.5 }).draft.weightKg).toBe(52.5);
  });

  it("refuses a negative weight, more than 999 kg, or zero reps — and says why", () => {
    expect(draftProblem({ reps: 10, weightKg: -2.5 })).toBe("Le poids ne peut pas être négatif.");
    expect(draftProblem({ reps: 10, weightKg: 1000 })).toBe(
      "Le poids ne peut pas dépasser 999 kg."
    );
    expect(draftProblem({ reps: 0, weightKg: 50 })).toBe("Note au moins 1 répétition.");
    expect(draftProblem({ reps: 10, weightKg: null })).toBeNull();
    const s = initialWorkoutState({ sessionLogId: "l", sessionId: "s", exercises: [ex("a")] });
    const heavy = workoutReducer(s, { type: "set-weight", value: 1200 });
    expect(workoutReducer(heavy, { type: "validate-set", at: "x" }).logged).toHaveLength(0);
  });
});

describe("story 5.5 — résumé", () => {
  it("3 sets of 10 at 50 kg is 1 500 kg", () => {
    const s = initialWorkoutState({
      sessionLogId: "l",
      sessionId: "s",
      exercises: [ex("a")],
      logged: [set("a", 1), set("a", 2), set("a", 3)],
    });
    const recap = sessionRecap(
      s,
      "2026-08-17T18:00:00.000Z",
      Date.parse("2026-08-17T18:38:12.000Z")
    );
    expect(recap.volumeKg).toBe(1500);
    expect(formatKg(recap.volumeKg)).toBe("1 500");
    expect(recap.setsDone).toBe(3);
    expect(recap.setsPlanned).toBe(3);
    expect(formatElapsed(recap.durationSeconds)).toBe("38:12");
  });

  it("counts the sets still to do across the session", () => {
    const s = initialWorkoutState({
      sessionLogId: "l",
      sessionId: "s",
      exercises: [ex("a"), ex("b", 2)],
      logged: [set("a", 1), set("a", 2), set("a", 3)],
    });
    expect(remainingSets(s)).toBe(2);
  });

  it("ignores weightless sets in the volume and formats long durations", () => {
    expect(volumeKg([set("a", 1, { weightKg: null })])).toBe(0);
    expect(formatElapsed(3909)).toBe("1:05:09");
    expect(formatKg(52.5)).toBe("52,5");
  });
});

describe("story 5.6 — effort", () => {
  it("keeps, changes and clears the effort of a set", () => {
    let s = initialWorkoutState({
      sessionLogId: "l",
      sessionId: "s",
      exercises: [ex("a")],
      logged: [set("a", 1)],
    });
    s = workoutReducer(s, { type: "set-rpe", exerciseId: "a", setNumber: 1, rpe: 8 });
    expect(s.logged[0]?.rpe).toBe(8);
    s = workoutReducer(s, { type: "set-rpe", exerciseId: "a", setNumber: 1, rpe: 12 });
    expect(s.logged[0]?.rpe).toBe(10);
    s = workoutReducer(s, { type: "set-rpe", exerciseId: "a", setNumber: 1, rpe: null });
    expect(s.logged[0]?.rpe).toBeNull();
  });
});

describe("story 5.3 — the session kept on the phone", () => {
  it("merges server and phone sets slot by slot, the phone winning", () => {
    const merged = mergeLogged([set("a", 1), set("a", 2)], [set("a", 2, { rpe: 7 }), set("a", 3)]);
    expect(merged.map((m) => m.setNumber)).toEqual([1, 2, 3]);
    expect(merged.find((m) => m.setNumber === 2)?.rpe).toBe(7);
  });

  it("parses a record and drops anything unusable", () => {
    const record = {
      athleteId: "a",
      sessionId: "s",
      sessionLogId: "l",
      startedAt: "2026-08-17T18:00:00Z",
      programAssignmentId: null,
      logged: [set("x", 1), { junk: true }],
      completion: null,
    };
    expect(parseActiveSession(JSON.stringify(record))?.logged).toHaveLength(1);
    expect(parseActiveSession("{")).toBeNull();
    expect(parseActiveSession(JSON.stringify({ athleteId: "a" }))).toBeNull();
  });

  it("makes RFC 4122 v4 ids", () => {
    const ids = new Set(Array.from({ length: 50 }, newUuid));
    expect(ids.size).toBe(50);
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
