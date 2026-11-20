import { dayAccessibilityLabel, stripState } from "@/utils/week-strip";

describe("week strip states (story 4.3)", () => {
  it("turns a planned day before today without a log into « manqué »", () => {
    expect(stripState({ dayOfWeek: 2, isToday: false, state: "upcoming" }, 4)).toBe("missed");
    expect(stripState({ dayOfWeek: 4, isToday: true, state: "upcoming" }, 4)).toBe("upcoming");
    expect(stripState({ dayOfWeek: 5, isToday: false, state: "upcoming" }, 4)).toBe("upcoming");
    expect(stripState({ dayOfWeek: 1, isToday: false, state: "completed" }, 4)).toBe("completed");
    expect(stripState({ dayOfWeek: 1, isToday: false, state: "rest" }, 4)).toBe("rest");
  });

  it("says the day and its state", () => {
    expect(dayAccessibilityLabel({ dayOfWeek: 2, isToday: false, state: "upcoming" }, 4)).toBe(
      "mardi, manqué"
    );
    expect(dayAccessibilityLabel({ dayOfWeek: 4, isToday: true, state: "started" }, 4)).toBe(
      "jeudi (aujourd'hui), commencé"
    );
  });
});
