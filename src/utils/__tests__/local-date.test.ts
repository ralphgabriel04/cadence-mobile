import { localDateISO } from "../local-date";

describe("localDateISO", () => {
  it("formats as yyyy-mm-dd with zero padding", () => {
    expect(localDateISO(new Date(2026, 0, 5, 12, 0, 0))).toBe("2026-01-05");
    expect(localDateISO(new Date(2026, 11, 25, 12, 0, 0))).toBe("2026-12-25");
  });

  it("uses the local calendar day, not the UTC one", () => {
    // 23:30 local on the 17th. toISOString() would report the 18th for any
    // timezone at or ahead of UTC+1, and the 17th behind it -- so the date the
    // athlete sees would depend on where they are. Local components do not.
    const lateEvening = new Date(2026, 7, 17, 23, 30, 0);
    expect(localDateISO(lateEvening)).toBe("2026-08-17");

    const earlyMorning = new Date(2026, 7, 17, 0, 30, 0);
    expect(localDateISO(earlyMorning)).toBe("2026-08-17");
  });

  it("agrees with the local date components for a full day of hours", () => {
    for (let hour = 0; hour < 24; hour++) {
      const d = new Date(2026, 7, 17, hour, 0, 0);
      expect(localDateISO(d)).toBe("2026-08-17");
    }
  });
});
