import {
  fromDayNumber,
  isoDayOfWeek,
  occurrenceState,
  sessionDate,
  toDayNumber,
  weekCount,
} from "../program-schedule";

describe("toDayNumber / fromDayNumber", () => {
  it("round-trips", () => {
    for (const iso of ["2026-01-01", "2026-08-17", "2026-12-31", "2028-02-29"]) {
      expect(fromDayNumber(toDayNumber(iso))).toBe(iso);
    }
  });

  it("crosses a DST boundary without drifting", () => {
    // North American DST starts 2026-03-08. Adding 7 days with local-time
    // arithmetic lands an hour short and can report 03-14.
    const before = toDayNumber("2026-03-07");
    expect(fromDayNumber(before + 7)).toBe("2026-03-14");

    // And in the autumn, when the clocks go back.
    const autumn = toDayNumber("2026-10-31");
    expect(fromDayNumber(autumn + 7)).toBe("2026-11-07");
  });

  it("rejects a value that is not a date", () => {
    expect(() => toDayNumber("pas-une-date")).toThrow(/yyyy-mm-dd/);
  });
});

describe("isoDayOfWeek", () => {
  it("maps Monday to 1 and Sunday to 7", () => {
    expect(isoDayOfWeek("2026-08-17")).toBe(1); // Monday
    expect(isoDayOfWeek("2026-08-19")).toBe(3); // Wednesday
    expect(isoDayOfWeek("2026-08-23")).toBe(7); // Sunday
  });
});

describe("sessionDate", () => {
  it("places week 1 sessions relative to a Monday start", () => {
    const start = "2026-08-17"; // Monday
    expect(sessionDate(start, 1, 1)).toBe("2026-08-17");
    expect(sessionDate(start, 1, 3)).toBe("2026-08-19");
    expect(sessionDate(start, 1, 5)).toBe("2026-08-21");
  });

  it("walks forward when the program starts mid-week", () => {
    // Week 1 runs Wednesday 19th to Tuesday 25th. A Monday session belongs to
    // the 24th -- six days IN, not five days before the program started.
    const start = "2026-08-19"; // Wednesday
    expect(sessionDate(start, 1, 3)).toBe("2026-08-19");
    expect(sessionDate(start, 1, 5)).toBe("2026-08-21");
    expect(sessionDate(start, 1, 1)).toBe("2026-08-24");
    expect(sessionDate(start, 1, 2)).toBe("2026-08-25");
  });

  it("advances a full week per week number", () => {
    const start = "2026-08-17";
    expect(sessionDate(start, 2, 1)).toBe("2026-08-24");
    expect(sessionDate(start, 4, 1)).toBe("2026-09-07");
    expect(sessionDate(start, 12, 5)).toBe("2026-11-06");
  });

  it("returns null for a session with no day", () => {
    expect(sessionDate("2026-08-17", 1, null)).toBeNull();
  });

  it("agrees with program_week_number: the date of week w maps back to week w", () => {
    // program_week_number(start, d) = (d - start) / 7 + 1, integer division.
    const start = "2026-08-19"; // deliberately not a Monday
    for (let week = 1; week <= 8; week++) {
      for (let dow = 1; dow <= 7; dow++) {
        const date = sessionDate(start, week, dow);
        if (date === null) continue;
        const derivedWeek = Math.floor((toDayNumber(date) - toDayNumber(start)) / 7) + 1;
        expect(derivedWeek).toBe(week);
      }
    }
  });
});

describe("weekCount", () => {
  it("uses the declared duration when it is longer", () => {
    // A 12-week program with only week 1 written out is still 12 weeks: showing
    // one week would hide that the rest is empty.
    expect(weekCount(12, [1, 1, 1])).toBe(12);
  });

  it("uses the sessions when they run past the declared duration", () => {
    expect(weekCount(4, [1, 2, 6])).toBe(6);
  });

  it("never returns less than one week", () => {
    expect(weekCount(null, [])).toBe(1);
    expect(weekCount(0, [null, null])).toBe(1);
  });
});

describe("occurrenceState", () => {
  const today = "2026-08-19";

  it("is completed when a log on that date says so", () => {
    expect(
      occurrenceState({
        scheduledDate: "2026-08-17",
        todayDate: today,
        logs: [{ date: "2026-08-17", status: "completed" }],
      }),
    ).toBe("completed");
  });

  it("is skipped when the log says skipped", () => {
    expect(
      occurrenceState({
        scheduledDate: "2026-08-17",
        todayDate: today,
        logs: [{ date: "2026-08-17", status: "skipped" }],
      }),
    ).toBe("skipped");
  });

  it("is missed when the date has passed with no log", () => {
    expect(
      occurrenceState({ scheduledDate: "2026-08-17", todayDate: today, logs: [] }),
    ).toBe("missed");
  });

  it("is today on the day itself", () => {
    expect(
      occurrenceState({ scheduledDate: today, todayDate: today, logs: [] }),
    ).toBe("today");
  });

  it("is upcoming in the future", () => {
    expect(
      occurrenceState({ scheduledDate: "2026-08-21", todayDate: today, logs: [] }),
    ).toBe("upcoming");
  });

  it("does not let one week's log complete another week's occurrence", () => {
    // The reason matching is by date and not by session id: a session with
    // week_number = NULL repeats, and every occurrence shares the same id.
    const logs = [{ date: "2026-08-17", status: "completed" as const }];

    expect(occurrenceState({ scheduledDate: "2026-08-17", todayDate: today, logs })).toBe(
      "completed",
    );
    expect(occurrenceState({ scheduledDate: "2026-08-24", todayDate: today, logs })).toBe(
      "upcoming",
    );
  });

  it("leaves a session with no scheduled day as upcoming, never missed", () => {
    expect(
      occurrenceState({ scheduledDate: null, todayDate: today, logs: [] }),
    ).toBe("upcoming");
  });

  it("ignores an in-progress log rather than counting it as done", () => {
    expect(
      occurrenceState({
        scheduledDate: "2026-08-17",
        todayDate: today,
        logs: [{ date: "2026-08-17", status: "in_progress" }],
      }),
    ).toBe("missed");
  });
});
