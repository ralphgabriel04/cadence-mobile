import { emptyFixture, errorFixture, readyFixture } from "../fixtures";
import type { TodayWorkout } from "../types";

describe("today fixtures", () => {
  it("ready: carries exactly 7 days of weekly compliance, one marked as today", () => {
    expect(readyFixture.status).toBe("ready");
    if (readyFixture.status !== "ready") return;

    expect(readyFixture.weeklyCompliance).toHaveLength(7);

    const todays = readyFixture.weeklyCompliance.filter((day) => day.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0]?.date).toBe(readyFixture.localDate);
  });

  it("ready: today's workout has an assigned coach, but the field allows null", () => {
    expect(readyFixture.status).toBe("ready");
    if (readyFixture.status !== "ready") return;

    expect(readyFixture.todayWorkout?.coachName).toBe("Coach Véronique");

    // Coaching is optional (issue: "coach facultatif") — a workout without a
    // coach must still type-check and be a valid TodayWorkout.
    const soloWorkout: TodayWorkout = {
      id: "wk-solo",
      title: "Course libre",
      exerciseCount: 1,
      estimatedDurationMinutes: 40,
      coachName: null,
      state: "scheduled",
    };
    expect(soloWorkout.coachName).toBeNull();
  });

  it("ready: 0 to 3 personal records", () => {
    expect(readyFixture.status).toBe("ready");
    if (readyFixture.status !== "ready") return;

    expect(readyFixture.personalRecords.length).toBeGreaterThanOrEqual(0);
    expect(readyFixture.personalRecords.length).toBeLessThanOrEqual(3);
  });

  it("empty: carries no data beyond its status", () => {
    expect(emptyFixture).toEqual({ status: "empty" });
  });

  it("error: carries a human-readable message", () => {
    expect(errorFixture.status).toBe("error");
    if (errorFixture.status !== "error") return;

    expect(typeof errorFixture.message).toBe("string");
    expect(errorFixture.message.length).toBeGreaterThan(0);
  });

  it("covers all three real states with distinct status values", () => {
    const statuses = [readyFixture.status, emptyFixture.status, errorFixture.status];
    expect(new Set(statuses).size).toBe(3);
  });
});
