import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchTodayScreen, parseTodayScreen } from "@/services/today-session";
import type { Database } from "@/types/database";

// ── Test double ──────────────────────────────────────────────────────────────

type RpcResponse = { data: unknown; error: { message: string; code?: string } | null };

/**
 * A client stub exposing only `rpc`, which is all the service calls.
 *
 * The double cast is deliberate and confined to tests: building a structurally
 * complete SupabaseClient would mean stubbing dozens of unrelated members, and
 * the service's contract with the client is exactly one method.
 */
function stubClient(response: RpcResponse, spy?: (args: unknown) => void): SupabaseClient<Database> {
  return {
    rpc: (_fn: string, args: unknown) => {
      spy?.(args);
      return Promise.resolve(response);
    },
  } as unknown as SupabaseClient<Database>;
}

// ── Payload builders ─────────────────────────────────────────────────────────

function week(overrides: Record<string, unknown> = {}) {
  return {
    weekNumber: 1,
    days: Array.from({ length: 7 }, (_unused, i) => ({
      dayOfWeek: i + 1,
      isToday: i === 0,
      state: i === 0 ? "upcoming" : "rest",
    })),
    completedCount: 0,
    scheduledCount: 1,
    ...overrides,
  };
}

function exercise(overrides: Record<string, unknown> = {}) {
  return {
    sessionExerciseId: "se-1",
    exerciseId: "ex-1",
    name: "Développé couché",
    category: "strength",
    equipment: "Barre",
    muscleGroups: ["pectoraux", "triceps"],
    videoUrl: null,
    instructions: null,
    orderIndex: 0,
    sets: 4,
    reps: "8-12",
    weightSuggestion: null,
    restSeconds: 90,
    tempo: "3-1-1-0",
    notes: null,
    supersetGroup: null,
    lastPerformance: null,
    ...overrides,
  };
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "s-1",
    name: "Jour A",
    description: null,
    estimatedDurationMinutes: 55,
    weekNumber: 1,
    dayOfWeek: 1,
    exercises: [exercise()],
    programName: "Full body 3j",
    coachFirstName: null,
    ...overrides,
  };
}

function payload(today: unknown, overrides: Record<string, unknown> = {}) {
  return {
    athleteFirstName: "Félix",
    date: "2026-08-17",
    today,
    week: week(),
    lastSession: null,
    ...overrides,
  };
}

// ── One test per state of the contract ───────────────────────────────────────

describe("fetchTodayScreen — contract states", () => {
  it("no-active-program", async () => {
    const client = stubClient({ data: payload({ state: "no-active-program" }), error: null });
    const result = await fetchTodayScreen({ onDate: "2026-08-17", client });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.today.state).toBe("no-active-program");
    expect(result.data.athleteFirstName).toBe("Félix");
    expect(result.data.week.days).toHaveLength(7);
  });

  it("rest-day, with the next session", async () => {
    const client = stubClient({
      data: payload({
        state: "rest-day",
        programName: "Full body 3j",
        nextSession: { sessionId: "s-2", name: "Jour B", dayOfWeek: 3 },
      }),
      error: null,
    });
    const result = await fetchTodayScreen({ onDate: "2026-08-18", client });

    expect(result.ok).toBe(true);
    if (!result.ok || result.data.today.state !== "rest-day") {
      throw new Error("expected rest-day");
    }
    expect(result.data.today.nextSession?.dayOfWeek).toBe(3);
  });

  it("rest-day with no session left in the week", async () => {
    const client = stubClient({
      data: payload({ state: "rest-day", programName: "P", nextSession: null }),
      error: null,
    });
    const result = await fetchTodayScreen({ client });

    if (!result.ok || result.data.today.state !== "rest-day") throw new Error("expected rest-day");
    expect(result.data.today.nextSession).toBeNull();
  });

  it("scheduled, with the prescription", async () => {
    const client = stubClient({ data: payload({ state: "scheduled", session: session() }), error: null });
    const result = await fetchTodayScreen({ client });

    if (!result.ok || result.data.today.state !== "scheduled") throw new Error("expected scheduled");
    const first = result.data.today.session.exercises[0];
    expect(first).toBeDefined();
    expect(first?.reps).toBe("8-12");
    expect(first?.restSeconds).toBe(90);
    expect(first?.muscleGroups).toEqual(["pectoraux", "triceps"]);
  });

  it("in-progress, with pause fields", async () => {
    const client = stubClient({
      data: payload({
        state: "in-progress",
        session: session(),
        log: {
          sessionLogId: "sl-1",
          startedAt: "2026-08-17T18:00:00Z",
          status: "in_progress",
          loggedSetCount: 3,
          pausedAt: null,
          totalPausedSeconds: 0,
        },
      }),
      error: null,
    });
    const result = await fetchTodayScreen({ client });

    if (!result.ok || result.data.today.state !== "in-progress") {
      throw new Error("expected in-progress");
    }
    expect(result.data.today.log.loggedSetCount).toBe(3);
    expect(result.data.today.log.totalPausedSeconds).toBe(0);
  });

  it("completed, with duration and RPE", async () => {
    const client = stubClient({
      data: payload({
        state: "completed",
        session: session(),
        log: {
          sessionLogId: "sl-1",
          startedAt: "2026-08-17T18:00:00Z",
          status: "completed",
          loggedSetCount: 12,
          completedAt: "2026-08-17T19:05:00Z",
          durationMinutes: 52,
          overallRpe: 8,
          notes: "Bonne séance",
        },
      }),
      error: null,
    });
    const result = await fetchTodayScreen({ client });

    if (!result.ok || result.data.today.state !== "completed") throw new Error("expected completed");
    expect(result.data.today.log.durationMinutes).toBe(52);
    expect(result.data.today.log.overallRpe).toBe(8);
  });

  it("skipped", async () => {
    const client = stubClient({
      data: payload({
        state: "skipped",
        session: session(),
        log: {
          sessionLogId: "sl-1",
          startedAt: null,
          status: "skipped",
          loggedSetCount: 0,
        },
      }),
      error: null,
    });
    const result = await fetchTodayScreen({ client });

    if (!result.ok || result.data.today.state !== "skipped") throw new Error("expected skipped");
    expect(result.data.today.log.loggedSetCount).toBe(0);
  });
});

// ── The last performance, which is why the RPC exists ───────────────────────

describe("fetchTodayScreen — embedded last performance", () => {
  it("parses the sets of the previous session", async () => {
    const client = stubClient({
      data: payload({
        state: "scheduled",
        session: session({
          exercises: [
            exercise({
              lastPerformance: {
                performedAt: "2026-08-10T19:00:00Z",
                sets: [
                  {
                    setNumber: 1,
                    repsCompleted: 10,
                    weightKg: 70,
                    rpe: 7,
                    durationSeconds: null,
                    distanceMeters: null,
                    isPr: false,
                  },
                  {
                    setNumber: 2,
                    repsCompleted: 8,
                    weightKg: 75,
                    rpe: 8,
                    durationSeconds: null,
                    distanceMeters: null,
                    isPr: true,
                  },
                ],
              },
            }),
          ],
        }),
      }),
      error: null,
    });

    const result = await fetchTodayScreen({ client });
    if (!result.ok || result.data.today.state !== "scheduled") throw new Error("expected scheduled");

    const lp = result.data.today.session.exercises[0]?.lastPerformance;
    expect(lp).not.toBeNull();
    expect(lp?.sets).toHaveLength(2);
    expect(lp?.sets[1]?.isPr).toBe(true);
    expect(lp?.sets[1]?.weightKg).toBe(75);
  });

  it("accepts a numeric weight that arrives as a string", () => {
    // A wide NUMERIC is serialised as a string by PostgREST rather than losing
    // precision. Rejecting it would fail on a perfectly valid weight.
    const parsed = parseTodayScreen(
      payload({
        state: "scheduled",
        session: session({
          exercises: [
            exercise({
              lastPerformance: {
                performedAt: "2026-08-10T19:00:00Z",
                sets: [
                  {
                    setNumber: 1,
                    repsCompleted: 10,
                    weightKg: "72.5",
                    rpe: null,
                    durationSeconds: null,
                    distanceMeters: null,
                    isPr: false,
                  },
                ],
              },
            }),
          ],
        }),
      }),
    );

    if (parsed.today.state !== "scheduled") throw new Error("expected scheduled");
    expect(parsed.today.session.exercises[0]?.lastPerformance?.sets[0]?.weightKg).toBe(72.5);
  });
});

// ── Failure mapping ─────────────────────────────────────────────────────────

describe("fetchTodayScreen — failures", () => {
  it("maps a NULL payload to unauthenticated", async () => {
    // get_today_screen() returns NULL when auth.uid() is null. That must not be
    // read as "nothing planned".
    const client = stubClient({ data: null, error: null });
    const result = await fetchTodayScreen({ client });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("unauthenticated");
  });

  it("maps an expired JWT to unauthenticated", async () => {
    const client = stubClient({
      data: null,
      error: { message: "JWT expired", code: "PGRST301" },
    });
    const result = await fetchTodayScreen({ client });

    if (result.ok) throw new Error("expected failure");
    expect(result.failure.kind).toBe("unauthenticated");
  });

  it("maps any other error to network, keeping the message", async () => {
    const client = stubClient({
      data: null,
      error: { message: "fetch failed", code: "ECONN" },
    });
    const result = await fetchTodayScreen({ client });

    if (result.ok) throw new Error("expected failure");
    expect(result.failure.kind).toBe("network");
    if (result.failure.kind !== "network") return;
    expect(result.failure.message).toBe("fetch failed");
  });

  it("reports a malformed payload with the failing path", async () => {
    const broken = payload({ state: "scheduled", session: session({ exercises: [exercise({ sets: "quatre" })] }) });
    const client = stubClient({ data: broken, error: null });
    const result = await fetchTodayScreen({ client });

    if (result.ok) throw new Error("expected failure");
    expect(result.failure.kind).toBe("malformed");
    if (result.failure.kind !== "malformed") return;
    expect(result.failure.message).toContain("exercises[0].sets");
  });

  it("rejects an unknown state instead of silently degrading", () => {
    // A migration that outran the client must fail loudly: falling back to
    // "no-active-program" would tell the athlete they have no program.
    expect(() => parseTodayScreen(payload({ state: "hibernating" }))).toThrow(/a known state/);
  });

  it("rejects a week strip that is not seven days", () => {
    expect(() =>
      parseTodayScreen(payload({ state: "no-active-program" }, { week: week({ days: [] }) })),
    ).toThrow(/exactly 7 entries/);
  });

  it("rejects a null where the contract requires a value", () => {
    expect(() =>
      parseTodayScreen(payload({ state: "rest-day", programName: null, nextSession: null })),
    ).toThrow(/programName should be a string/);
  });
});

// ── The date is the caller's, never the server's ────────────────────────────

describe("fetchTodayScreen — date handling", () => {
  it("passes the supplied local date through to the RPC", async () => {
    let seen: unknown = undefined;
    const client = stubClient(
      { data: payload({ state: "no-active-program" }), error: null },
      (args) => {
        seen = args;
      },
    );

    await fetchTodayScreen({ onDate: "2026-12-25", client });
    expect(seen).toEqual({ p_on_date: "2026-12-25" });
  });

  it("defaults to the device's local date, not UTC", async () => {
    let seen: unknown = undefined;
    const client = stubClient(
      { data: payload({ state: "no-active-program" }), error: null },
      (args) => {
        seen = args;
      },
    );

    await fetchTodayScreen({ client });

    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    expect(seen).toEqual({ p_on_date: expected });
  });
});
