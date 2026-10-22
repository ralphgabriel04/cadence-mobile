import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchProgramPlan } from "@/services/program-plan";
import type { Database } from "@/types/database";

// ── Test double ──────────────────────────────────────────────────────────────

type Response = { data: unknown; error: { message: string; code?: string } | null };

/**
 * Chainable stub of the query builder. The service only walks
 * from -> select -> eq -> order -> limit -> maybeSingle, so every link returns
 * the same object and the terminal method resolves.
 *
 * The double cast is confined to tests: building a structurally complete
 * SupabaseClient would mean stubbing dozens of unrelated members.
 */
function stubClient(response: Response): SupabaseClient<Database> {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(response),
  };
  return { from: () => builder } as unknown as SupabaseClient<Database>;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

type LogFixture = { id: string; status: string; started_at: string | null; completed_at: string | null };

function sessionRow(overrides: {
  id: string;
  name: string;
  day_of_week: number | null;
  week_number: number | null;
  exercises?: number;
  logs?: LogFixture[];
}) {
  return {
    id: overrides.id,
    name: overrides.name,
    description: null,
    day_of_week: overrides.day_of_week,
    week_number: overrides.week_number,
    order_index: 0,
    estimated_duration_minutes: 55,
    session_exercises: Array.from({ length: overrides.exercises ?? 2 }, (_u, i) => ({
      id: `${overrides.id}-ex-${i}`,
    })),
    session_logs: overrides.logs ?? [],
  };
}

function assignmentRow(sessions: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    id: "pa-1",
    start_date: "2026-08-17", // a Monday
    end_date: null,
    status: "active",
    programs: {
      id: "p-1",
      name: "Full body 3j",
      description: "Trois séances par semaine",
      goal: "Hypertrophie",
      difficulty: "beginner",
      duration_weeks: 4,
      sessions,
    },
    ...overrides,
  };
}

const MON = 1;
const WED = 3;
const FRI = 5;

// ── No plan ──────────────────────────────────────────────────────────────────

describe("fetchProgramPlan — no plan", () => {
  it("returns no-active-program when there is no assignment", async () => {
    const result = await fetchProgramPlan({ client: stubClient({ data: null, error: null }) });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.kind).toBe("no-active-program");
  });

  it("treats an assignment with no start date as no plan", async () => {
    // Every week boundary and every session date derives from start_date. With
    // none, the plan cannot be laid out at all -- better to say so than to
    // invent a start and show a wrong calendar.
    const result = await fetchProgramPlan({
      client: stubClient({
        data: assignmentRow([sessionRow({ id: "s1", name: "A", day_of_week: MON, week_number: 1 })], {
          start_date: null,
        }),
        error: null,
      }),
    });

    if (!result.ok) throw new Error("expected ok");
    expect(result.state.kind).toBe("no-active-program");
  });
});

// ── Week layout ──────────────────────────────────────────────────────────────

describe("fetchProgramPlan — week layout", () => {
  const sessions = [
    sessionRow({ id: "s1", name: "Jour A", day_of_week: MON, week_number: 1 }),
    sessionRow({ id: "s2", name: "Jour B", day_of_week: WED, week_number: 1 }),
    sessionRow({ id: "s3", name: "Jour C", day_of_week: FRI, week_number: 1 }),
  ];

  it("emits one week per declared duration, empty weeks included", async () => {
    const result = await fetchProgramPlan({
      onDate: "2026-08-17",
      client: stubClient({ data: assignmentRow(sessions), error: null }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    const { weeks } = result.state.plan;

    // duration_weeks = 4 but only week 1 is written out. Showing one week would
    // hide from the athlete that weeks 2 to 4 are empty.
    expect(weeks).toHaveLength(4);
    expect(weeks[0]?.sessions).toHaveLength(3);
    expect(weeks[1]?.sessions).toHaveLength(0);
    expect(weeks[3]?.sessions).toHaveLength(0);
  });

  it("dates each week from the assignment start", async () => {
    const result = await fetchProgramPlan({
      onDate: "2026-08-17",
      client: stubClient({ data: assignmentRow(sessions), error: null }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    const { weeks } = result.state.plan;

    expect(weeks[0]?.startDate).toBe("2026-08-17");
    expect(weeks[0]?.endDate).toBe("2026-08-23");
    expect(weeks[1]?.startDate).toBe("2026-08-24");
    expect(weeks[3]?.startDate).toBe("2026-09-07");
  });

  it("flags exactly one week as current", async () => {
    const result = await fetchProgramPlan({
      onDate: "2026-08-26", // inside week 2
      client: stubClient({ data: assignmentRow(sessions), error: null }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    const current = result.state.plan.weeks.filter((w) => w.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0]?.weekNumber).toBe(2);
  });

  it("flags no week as current once the program is over", async () => {
    const result = await fetchProgramPlan({
      onDate: "2027-01-01",
      client: stubClient({ data: assignmentRow(sessions), error: null }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    expect(result.state.plan.weeks.some((w) => w.isCurrent)).toBe(false);
  });

  it("orders sessions by day of week", async () => {
    const scrambled = [
      sessionRow({ id: "s3", name: "Jour C", day_of_week: FRI, week_number: 1 }),
      sessionRow({ id: "s1", name: "Jour A", day_of_week: MON, week_number: 1 }),
      sessionRow({ id: "s2", name: "Jour B", day_of_week: WED, week_number: 1 }),
    ];
    const result = await fetchProgramPlan({
      onDate: "2026-08-17",
      client: stubClient({ data: assignmentRow(scrambled), error: null }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    expect(result.state.plan.weeks[0]?.sessions.map((s) => s.name)).toEqual([
      "Jour A",
      "Jour B",
      "Jour C",
    ]);
  });

  it("repeats a session with no week number in every week", async () => {
    const result = await fetchProgramPlan({
      onDate: "2026-08-17",
      client: stubClient({
        data: assignmentRow([
          sessionRow({ id: "s1", name: "Séance hebdo", day_of_week: MON, week_number: null }),
        ]),
        error: null,
      }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    for (const w of result.state.plan.weeks) {
      expect(w.sessions).toHaveLength(1);
    }
    expect(result.state.plan.weeks[1]?.sessions[0]?.scheduledDate).toBe("2026-08-24");
  });
});

// ── Session state ────────────────────────────────────────────────────────────

describe("fetchProgramPlan — session state", () => {
  it("marks past, present and future correctly", async () => {
    const sessions = [
      sessionRow({ id: "s1", name: "Lundi", day_of_week: MON, week_number: 1 }),
      sessionRow({ id: "s2", name: "Mercredi", day_of_week: WED, week_number: 1 }),
      sessionRow({ id: "s3", name: "Vendredi", day_of_week: FRI, week_number: 1 }),
    ];

    const result = await fetchProgramPlan({
      onDate: "2026-08-19", // Wednesday of week 1
      client: stubClient({ data: assignmentRow(sessions), error: null }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    const week1 = result.state.plan.weeks[0]?.sessions ?? [];
    expect(week1.map((s) => s.state)).toEqual(["missed", "today", "upcoming"]);
  });

  it("marks a session completed from a log on its own date", async () => {
    const sessions = [
      sessionRow({
        id: "s1",
        name: "Lundi",
        day_of_week: MON,
        week_number: 1,
        logs: [
          {
            id: "sl-1",
            status: "completed",
            started_at: "2026-08-17T18:00:00Z",
            completed_at: "2026-08-17T19:00:00Z",
          },
        ],
      }),
    ];

    const result = await fetchProgramPlan({
      onDate: "2026-08-19",
      client: stubClient({ data: assignmentRow(sessions), error: null }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    expect(result.state.plan.weeks[0]?.sessions[0]?.state).toBe("completed");
    expect(result.state.plan.completedSessions).toBe(1);
  });

  it("does not let one week's log complete a repeating session everywhere", async () => {
    // The bug this guards: a session with week_number = NULL shares one id
    // across every occurrence, so matching a log by id alone would mark all
    // four weeks complete from a single workout.
    const sessions = [
      sessionRow({
        id: "s1",
        name: "Hebdo",
        day_of_week: MON,
        week_number: null,
        logs: [
          {
            id: "sl-1",
            status: "completed",
            started_at: "2026-08-17T18:00:00Z",
            completed_at: "2026-08-17T19:00:00Z",
          },
        ],
      }),
    ];

    const result = await fetchProgramPlan({
      onDate: "2026-08-19",
      client: stubClient({ data: assignmentRow(sessions), error: null }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    const states = result.state.plan.weeks.map((w) => w.sessions[0]?.state);
    expect(states).toEqual(["completed", "upcoming", "upcoming", "upcoming"]);
    expect(result.state.plan.completedSessions).toBe(1);
  });

  it("counts totals across the whole program", async () => {
    const sessions = [
      sessionRow({ id: "s1", name: "A", day_of_week: MON, week_number: 1, exercises: 6 }),
      sessionRow({ id: "s2", name: "B", day_of_week: WED, week_number: 2 }),
      sessionRow({ id: "s3", name: "C", day_of_week: FRI, week_number: 3 }),
    ];

    const result = await fetchProgramPlan({
      onDate: "2026-08-17",
      client: stubClient({ data: assignmentRow(sessions), error: null }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    expect(result.state.plan.totalSessions).toBe(3);
    expect(result.state.plan.completedSessions).toBe(0);
    expect(result.state.plan.weeks[0]?.sessions[0]?.exerciseCount).toBe(6);
  });

  it("ignores an in-progress log rather than counting it as done", async () => {
    const sessions = [
      sessionRow({
        id: "s1",
        name: "Lundi",
        day_of_week: MON,
        week_number: 1,
        logs: [
          { id: "sl-1", status: "in_progress", started_at: "2026-08-17T18:00:00Z", completed_at: null },
        ],
      }),
    ];

    const result = await fetchProgramPlan({
      onDate: "2026-08-19",
      client: stubClient({ data: assignmentRow(sessions), error: null }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    expect(result.state.plan.weeks[0]?.sessions[0]?.state).toBe("missed");
    expect(result.state.plan.completedSessions).toBe(0);
  });
});

// ── Failures ─────────────────────────────────────────────────────────────────

describe("fetchProgramPlan — failures", () => {
  it("maps an expired JWT to unauthenticated", async () => {
    const result = await fetchProgramPlan({
      client: stubClient({ data: null, error: { message: "JWT expired", code: "PGRST301" } }),
    });

    if (result.ok) throw new Error("expected failure");
    expect(result.failure.kind).toBe("unauthenticated");
  });

  it("maps anything else to network, keeping the message", async () => {
    const result = await fetchProgramPlan({
      client: stubClient({ data: null, error: { message: "fetch failed" } }),
    });

    if (result.ok) throw new Error("expected failure");
    expect(result.failure.kind).toBe("network");
    if (result.failure.kind !== "network") return;
    expect(result.failure.message).toBe("fetch failed");
  });
});

// ── The program that starts mid-week ────────────────────────────────────────

describe("fetchProgramPlan — mid-week start", () => {
  it("places a Monday session six days into a week that starts on Wednesday", async () => {
    const result = await fetchProgramPlan({
      onDate: "2026-08-19",
      client: stubClient({
        data: assignmentRow(
          [sessionRow({ id: "s1", name: "Lundi", day_of_week: MON, week_number: 1 })],
          { start_date: "2026-08-19" },
        ),
        error: null,
      }),
    });

    if (!result.ok || result.state.kind !== "plan") throw new Error("expected a plan");
    // Week 1 runs Wed 19th to Tue 25th, so the Monday session is the 24th --
    // not the 17th, which is before the program existed.
    expect(result.state.plan.weeks[0]?.startDate).toBe("2026-08-19");
    expect(result.state.plan.weeks[0]?.sessions[0]?.scheduledDate).toBe("2026-08-24");
    expect(result.state.plan.weeks[0]?.sessions[0]?.state).toBe("upcoming");
  });
});
