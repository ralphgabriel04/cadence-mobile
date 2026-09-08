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

function ready(today: TodayState) {
  mockUseTodaySession.mockReturnValue({
    state: { status: "ready", data: data(today) },
    refetch: jest.fn(),
  });
}

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
    expect(screen.getByText("Prochaine séance : Course — Z2, mardi")).toBeTruthy();
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
});
