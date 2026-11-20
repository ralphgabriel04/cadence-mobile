import type { SupabaseClient } from "@supabase/supabase-js";

import { createMemoryStore } from "@/services/local-store";
import { createTodayCache } from "@/services/today-cache";
import { fetchTodayScreen, parseScheduleOutlook } from "@/services/today-session";
import type { Database } from "@/types/database";

const week = {
  weekNumber: 1,
  days: Array.from({ length: 7 }, (_u, i) => ({
    dayOfWeek: i + 1,
    isToday: i === 1,
    state: "rest",
  })),
  completedCount: 0,
  scheduledCount: 0,
};
const todayPayload = {
  athleteFirstName: "Félix",
  date: "2026-08-18",
  today: { state: "rest-day", programName: "P", nextSession: null },
  week,
  lastSession: null,
};
const outlookPayload = {
  nextSession: { sessionId: "s-2", name: "Jour B", date: "2026-08-25", dayOfWeek: 2 },
  programFinished: false,
  weekSessions: [
    {
      dayOfWeek: 1,
      date: "2026-08-17",
      sessionId: "s-1",
      name: "Jour A",
      estimatedDurationMinutes: 45,
      exerciseCount: 2,
    },
  ],
};

function client(
  byFn: Record<string, { data: unknown; error: { message: string } | null } | Error>
) {
  const responses = new Map(Object.entries(byFn));
  return {
    rpc: (fn: string) => {
      const r = responses.get(fn);
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    },
  } as unknown as SupabaseClient<Database>;
}

describe("fetchTodayScreen + get_schedule_outlook (stories 4.2, 4.3)", () => {
  it("merges the outlook into the screen", async () => {
    const result = await fetchTodayScreen({
      client: client({
        get_today_screen: { data: todayPayload, error: null },
        get_schedule_outlook: { data: outlookPayload, error: null },
      }),
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.outlook?.nextSession?.date).toBe("2026-08-25");
    expect(result.data.outlook?.weekSessions[0]?.exerciseCount).toBe(2);
  });

  it("still renders the screen when the outlook fails", async () => {
    const result = await fetchTodayScreen({
      client: client({
        get_today_screen: { data: todayPayload, error: null },
        get_schedule_outlook: new Error("boom"),
      }),
    });
    expect(result.ok && result.data.outlook).toBeNull();
  });

  it("ignores a malformed outlook instead of failing the screen", async () => {
    const result = await fetchTodayScreen({
      client: client({
        get_today_screen: { data: todayPayload, error: null },
        get_schedule_outlook: { data: { programFinished: "yes" }, error: null },
      }),
    });
    expect(result.ok && result.data.outlook).toBeNull();
  });

  it("parses programme terminé", () => {
    expect(
      parseScheduleOutlook({ nextSession: null, programFinished: true, weekSessions: [] })
        .programFinished
    ).toBe(true);
  });
});

describe("today cache (story 4.1)", () => {
  it("gives the last copy back to the same account only", async () => {
    const cache = createTodayCache(createMemoryStore());
    const result = await fetchTodayScreen({
      client: client({
        get_today_screen: { data: todayPayload, error: null },
        get_schedule_outlook: { data: outlookPayload, error: null },
      }),
    });
    if (!result.ok) throw new Error("expected ok");
    cache.save("athlete-a", result.data, "2026-08-18T07:00:00Z");

    const mine = await cache.read("athlete-a");
    expect(mine?.savedAt).toBe("2026-08-18T07:00:00Z");
    expect(mine?.data.outlook?.nextSession?.name).toBe("Jour B");
    expect(await cache.read("athlete-b")).toBeNull();
    expect(await cache.read("")).toBeNull();
  });

  it("drops a corrupted copy rather than crashing", async () => {
    const cache = createTodayCache(
      createMemoryStore('{"athleteId":"a","savedAt":"x","data":{"nope":1}}')
    );
    expect(await cache.read("a")).toBeNull();
    const garbage = createTodayCache(createMemoryStore("not json"));
    expect(await garbage.read("a")).toBeNull();
  });

  it("is erased", async () => {
    const store = createMemoryStore();
    const cache = createTodayCache(store);
    cache.save("a", { ...todayPayload, today: { state: "no-active-program" } } as never);
    cache.erase();
    expect(await cache.read("a")).toBeNull();
  });
});
