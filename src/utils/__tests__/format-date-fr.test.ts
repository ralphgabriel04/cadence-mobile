import {
  dayInitialFr,
  dayNameFr,
  formatDateFr,
  formatDateRangeFr,
  formatDayAndMonthFr,
  formatDurationFr,
} from "../format-date-fr";

describe("dayNameFr / dayInitialFr", () => {
  it("maps ISODOW 1 to Monday", () => {
    expect(dayNameFr(1)).toBe("lundi");
    expect(dayNameFr(7)).toBe("dimanche");
    expect(dayInitialFr(1)).toBe("L");
    expect(dayInitialFr(7)).toBe("D");
  });

  it("returns an empty string rather than undefined out of range", () => {
    expect(dayNameFr(0)).toBe("");
    expect(dayNameFr(8)).toBe("");
  });
});

describe("formatDayAndMonthFr", () => {
  it("formats lowercase, with no year", () => {
    expect(formatDayAndMonthFr("2026-08-17")).toBe("lundi 17 août");
    expect(formatDayAndMonthFr("2026-12-25")).toBe("vendredi 25 décembre");
  });

  it("uses 1er for the first of the month", () => {
    expect(formatDayAndMonthFr("2026-09-01")).toBe("mardi 1er septembre");
  });

  it("keeps the accents", () => {
    expect(formatDayAndMonthFr("2026-02-10")).toBe("mardi 10 février");
    expect(formatDayAndMonthFr("2026-08-03")).toBe("lundi 3 août");
  });
});

describe("formatDateFr", () => {
  it("includes the year", () => {
    expect(formatDateFr("2026-08-17")).toBe("17 août 2026");
    expect(formatDateFr("2027-01-01")).toBe("1er janvier 2027");
  });
});

describe("formatDateRangeFr", () => {
  it("collapses the month when both ends share it", () => {
    expect(formatDateRangeFr("2026-08-17", "2026-08-23")).toBe("17 – 23 août");
  });

  it("keeps both months when the range crosses one", () => {
    expect(formatDateRangeFr("2026-08-31", "2026-09-06")).toBe("31 août – 6 septembre");
  });

  it("uses 1er at either end", () => {
    expect(formatDateRangeFr("2026-09-01", "2026-09-07")).toBe("1er – 7 septembre");
  });
});

describe("formatDurationFr", () => {
  it("stays in minutes below an hour", () => {
    expect(formatDurationFr(55)).toBe("55 min");
    expect(formatDurationFr(0)).toBe("0 min");
  });

  it("switches to hours, padding the minutes", () => {
    expect(formatDurationFr(60)).toBe("1 h");
    expect(formatDurationFr(85)).toBe("1 h 25");
    expect(formatDurationFr(65)).toBe("1 h 05");
    expect(formatDurationFr(125)).toBe("2 h 05");
  });
});

describe("malformed input", () => {
  it("throws instead of rendering 'undefined août'", () => {
    expect(() => formatDayAndMonthFr("pas-une-date")).toThrow(/yyyy-mm-dd/);
  });
});
