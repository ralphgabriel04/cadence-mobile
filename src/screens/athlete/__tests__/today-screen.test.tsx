import { fireEvent, render, screen } from "@testing-library/react-native";

import type {
  PlannedSession,
  PrescribedExercise,
  TodayScreenData,
  TodayState,
} from "@/types/today-screen";

import { AthleteTodayScreen } from "../today-screen";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: jest.fn(),
}));

const mockUseTodaySession = jest.fn();
jest.mock("@/hooks/use-today-session", () => ({
  useTodaySession: () => mockUseTodaySession(),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

function exercise(i: number): PrescribedExercise {
  return {
    sessionExerciseId: `se${i}`,
    exerciseId: `e${i}`,
    name: `Exercice ${i}`,
    category: "strength",
    equipment: null,
    muscleGroups: [],
    videoUrl: null,
    instructions: null,
    orderIndex: i,
    sets: 4,
    reps: "8",
    weightSuggestion: null,
    restSeconds: 90,
    tempo: null,
    notes: null,
    supersetGroup: null,
    lastPerformance: null,
  };
}

const session: PlannedSession = {
  sessionId: "s1",
  name: "Force — Haut du corps",
  description: null,
  estimatedDurationMinutes: 55,
  weekNumber: 3,
  dayOfWeek: 1,
  exercises: [0, 1, 2, 3, 4, 5].map(exercise),
  programName: "Bloc hypertrophie",
  coachFirstName: "Alex",
};

function data(today: TodayState): TodayScreenData {
  return {
    athleteFirstName: "Félix",
    date: "2026-05-04",
    today,
    week: {
      weekNumber: 3,
      days: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
        dayOfWeek,
        isToday: dayOfWeek === 1,
        state: dayOfWeek === 7 ? "rest" : "upcoming",
      })),
      completedCount: 0,
      scheduledCount: 6,
    },
    lastSession: {
      sessionLogId: "log0",
      name: "Force — Bas du corps",
      completedAt: "2026-05-01T18:00:00Z",
      exerciseCount: 8,
      durationMinutes: 52,
      prCount: 2,
    },
  };
}

function ready(today: TodayState, extra: Partial<TodayScreenData> = {}, offline?: { savedAt: string }) {
  mockUseTodaySession.mockReturnValue({
    state: { status: "ready", data: { ...data(today), ...extra }, offline },
    refetch: jest.fn(),
  });
}

const rest: TodayState = { state: "rest-day", programName: "Bloc", nextSession: null };

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AthleteTodayScreen", () => {
  it("shows the scheduled session and starts it", () => {
    ready({ state: "scheduled", session });
    render(<AthleteTodayScreen />);

    expect(screen.getByText("Bonjour, Félix")).toBeTruthy();
    expect(screen.getByText("Force — Haut du corps")).toBeTruthy();
    expect(screen.getByText("6 exercices")).toBeTruthy();
    expect(screen.getByText("Coach Alex")).toBeTruthy();
    expect(screen.getByText("2 PRs")).toBeTruthy();

    fireEvent.press(screen.getByText("Commencer la séance"));
    expect(mockPush).toHaveBeenCalledWith("/(athlete)/session");
  });

  it("shows a rest day without a call to action", () => {
    ready({
      state: "rest-day",
      programName: "Bloc hypertrophie",
      nextSession: { sessionId: "s2", name: "Course — Z2", dayOfWeek: 2 },
    });
    render(<AthleteTodayScreen />);

    expect(screen.getByText("Jour de repos")).toBeTruthy();
    expect(screen.getByText("Prochaine séance : mardi")).toBeTruthy();
    expect(screen.getByText("Course — Z2")).toBeTruthy();
    expect(screen.queryByText("Commencer la séance")).toBeNull();
  });

  it("offers a retry on a network failure", () => {
    const refetch = jest.fn();
    mockUseTodaySession.mockReturnValue({
      state: { status: "error", failure: { kind: "network", message: "offline" } },
      refetch,
    });
    render(<AthleteTodayScreen />);

    fireEvent.press(screen.getByText("Réessayer"));
    expect(refetch).toHaveBeenCalled();
  });

  // ── Story 4.1 ──
  it("shows the last known session with « Hors ligne » when offline", () => {
    ready({ state: "scheduled", session }, {}, { savedAt: "2026-05-04T07:30:00" });
    render(<AthleteTodayScreen />);
    expect(screen.getByText("Hors ligne")).toBeTruthy();
    expect(screen.getByText("Force — Haut du corps")).toBeTruthy();
  });

  it("reads the session name, exercise count and duration to the screen reader", () => {
    ready({ state: "scheduled", session });
    render(<AthleteTodayScreen />);
    expect(
      screen.getByLabelText("Aujourd'hui : Force — Haut du corps, 6 exercices, environ 55 min"),
    ).toBeTruthy();
  });

  // ── Story 4.2 ──
  it("names the next session's date when it is next week", () => {
    ready(rest, {
      outlook: {
        nextSession: { sessionId: "s9", name: "Jambes", date: "2099-01-13", dayOfWeek: 2 },
        programFinished: false,
        weekSessions: [],
      },
    });
    render(<AthleteTodayScreen />);
    expect(screen.getByText("Jour de repos")).toBeTruthy();
    expect(screen.getByText("Prochaine séance : mardi 13 janvier")).toBeTruthy();
  });

  it("says the program is finished instead of a date, and offers to choose one", () => {
    ready(rest, { outlook: { nextSession: null, programFinished: true, weekSessions: [] } });
    render(<AthleteTodayScreen />);
    expect(screen.getByText("Programme terminé")).toBeTruthy();
    expect(screen.queryByText(/Prochaine séance/)).toBeNull();
    expect(screen.queryByText("Commencer la séance")).toBeNull();
    fireEvent.press(screen.getByText("Voir le programme"));
    expect(mockPush).toHaveBeenCalledWith("/(athlete)/plan");
  });

  it("invites to choose a program when there is none", () => {
    ready({ state: "no-active-program" });
    render(<AthleteTodayScreen />);
    fireEvent.press(screen.getByText("Voir le programme"));
    expect(mockPush).toHaveBeenCalledWith("/(athlete)/plan");
  });

  // ── Story 4.3 ──
  it("labels each day with its state, readable without colour", () => {
    ready(
      { state: "scheduled", session: { ...session, dayOfWeek: 4 } },
      {
        date: "2026-05-07", // a Thursday
        week: {
          weekNumber: 3,
          days: [
            { dayOfWeek: 1, isToday: false, state: "completed" },
            { dayOfWeek: 2, isToday: false, state: "upcoming" },
            { dayOfWeek: 3, isToday: false, state: "rest" },
            { dayOfWeek: 4, isToday: true, state: "upcoming" },
            { dayOfWeek: 5, isToday: false, state: "upcoming" },
            { dayOfWeek: 6, isToday: false, state: "rest" },
            { dayOfWeek: 7, isToday: false, state: "rest" },
          ],
          completedCount: 1,
          scheduledCount: 4,
        },
      },
    );
    render(<AthleteTodayScreen />);
    expect(screen.getByLabelText("lundi, fait")).toBeTruthy();
    expect(screen.getByLabelText("mardi, manqué")).toBeTruthy();
    expect(screen.getByLabelText("jeudi (aujourd'hui), à venir")).toBeTruthy();
    expect(screen.getByLabelText("vendredi, à venir")).toBeTruthy();
    expect(screen.getByLabelText("samedi, repos")).toBeTruthy();
  });

  it("shows the session planned on a day touched in the strip, then returns to today", () => {
    ready(
      { state: "scheduled", session },
      {
        outlook: {
          nextSession: null,
          programFinished: false,
          weekSessions: [
            { dayOfWeek: 4, date: "2026-05-07", sessionId: "s4", name: "Jeudi — Jambes", estimatedDurationMinutes: 50, exerciseCount: 5 },
          ],
        },
      },
    );
    render(<AthleteTodayScreen />);
    fireEvent.press(screen.getByLabelText("jeudi, à venir"));
    expect(screen.getByText("Jeudi — Jambes")).toBeTruthy();
    expect(screen.getByText("5 exercices")).toBeTruthy();
    expect(screen.queryByText("Commencer la séance")).toBeNull();

    fireEvent.press(screen.getByLabelText("samedi, à venir"));
    expect(screen.getByText("Rien de prévu ce jour-là.")).toBeTruthy();

    fireEvent.press(screen.getByText("Revenir à aujourd'hui"));
    expect(screen.getByText("Commencer la séance")).toBeTruthy();
  });

  it("marks every day as rest in a week without sessions", () => {
    ready({ state: "no-active-program" }, {
      week: {
        weekNumber: null,
        days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, isToday: d === 1, state: "rest" as const })),
        completedCount: 0,
        scheduledCount: 0,
      },
    });
    render(<AthleteTodayScreen />);
    expect(screen.getByLabelText("mardi, repos")).toBeTruthy();
    expect(screen.getByLabelText("dimanche, repos")).toBeTruthy();
  });

  // ── Gaps found in review ──
  it("names the weekday when the next session is within six days", () => {
    ready(rest, {
      outlook: {
        nextSession: { sessionId: "s4", name: "Jambes", date: "2026-05-07", dayOfWeek: 4 },
        programFinished: false,
        weekSessions: [],
      },
    });
    render(<AthleteTodayScreen />);
    expect(screen.getByText("Prochaine séance : jeudi")).toBeTruthy();
    expect(screen.getByText("Jambes")).toBeTruthy();
  });

  it("says the program is finished when its end date has passed (no program in force)", () => {
    ready({ state: "no-active-program" }, { outlook: { nextSession: null, programFinished: true, weekSessions: [] } });
    render(<AthleteTodayScreen />);
    expect(screen.getByText("Programme terminé")).toBeTruthy();
    expect(screen.queryByText("Aucun programme en cours")).toBeNull();
  });

  it("explains what to do when there is no program", () => {
    ready({ state: "no-active-program" });
    render(<AthleteTodayScreen />);
    expect(screen.getByText("Aucun programme en cours")).toBeTruthy();
    expect(screen.getByText("Choisis un programme et ta séance du jour apparaîtra ici.")).toBeTruthy();
  });

  it("does not claim a day is empty when the week could not be loaded", () => {
    ready({ state: "scheduled", session }); // no outlook: get_schedule_outlook failed
    render(<AthleteTodayScreen />);
    fireEvent.press(screen.getByLabelText("jeudi, à venir"));
    expect(screen.queryByText("Rien de prévu ce jour-là.")).toBeNull();
    expect(
      screen.getByText("Impossible d'afficher ce jour-là pour l'instant. Réessaie avec du réseau."),
    ).toBeTruthy();
  });

  it("names the day of an offline copy kept from an earlier day instead of « Aujourd'hui »", () => {
    ready({ state: "scheduled", session }, {}, { savedAt: "2026-05-04T07:00:00Z" });
    render(<AthleteTodayScreen />);
    // The fixture's date (2026-05-04, a Monday) is not the device's date.
    expect(screen.getByText("lundi")).toBeTruthy();
    expect(screen.queryByText("Aujourd'hui")).toBeNull();
  });

  it("shows the seven days of the week", () => {
    ready({ state: "scheduled", session });
    render(<AthleteTodayScreen />);
    const days = screen.getAllByRole("button", { name: /^(lun|mar|mer|jeu|ven|sam|dim)/ });
    expect(days).toHaveLength(7);
  });
});
