import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { createActiveSessionStore } from "@/services/active-session";
import { createMemoryStore } from "@/services/local-store";
import { createMemoryStorage } from "@/services/set-queue";
import { resetSharedSetQueueForTests } from "@/services/training-sync";
import type { PrescribedExercise, TodayScreenData } from "@/types/today-screen";

import { LiveSessionScreen } from "../live-session-screen";

// ── Doubles ──────────────────────────────────────────────────────────────────

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn() }),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ state: { status: "ready", profile: { id: "me" } } }),
}));

let mockToday: TodayScreenData;
jest.mock("@/hooks/use-today-session", () => ({
  useTodaySession: () => ({ state: { status: "ready", data: mockToday }, refetch: jest.fn() }),
}));

// A fake rest timer: the real one needs notifications and the clock.
const mockRest = { start: jest.fn(), adjust: jest.fn(), cancel: jest.fn() };
jest.mock("@/hooks/use-rest-timer", () => ({
  useRestTimer: () => ({
    ...mockRest,
    remaining: 90,
    progress: 0,
    isResting: true,
    isFinished: false,
    notificationsReady: true,
  }),
}));

// No network at all (story 5.3): every server call fails like a dropped connection.
const mockSend = jest.fn(async () => ({
  ok: false,
  message: "Network request failed",
  retryable: true,
}));
const mockStart = jest.fn(async () => ({
  ok: false,
  kind: "network",
  message: "Network request failed",
}));
jest.mock("@/services/workout-session", () => ({
  startSession: (...a: unknown[]) => mockStart(...(a as [])),
  loadInProgressSession: jest.fn(async () => ({ ok: false, kind: "network", message: "offline" })),
  completeSession: jest.fn(async () => ({ ok: false, kind: "network", message: "offline" })),
  ensureSessionLog: jest.fn(async () => ({ ok: false, message: "offline" })),
  sendSet: (...a: unknown[]) => mockSend(...(a as [])),
}));

const mockDisk = createMemoryStorage();
jest.mock("@/services/queue-storage", () => ({
  createQueueStorage: () => mockDisk,
  eraseQueueFile: () => ({ erased: true }),
}));
jest.mock("@/services/purge-local-queue", () => ({
  mayRestoreLocalQueue: async () => true,
  purgeLocalSetQueue: async () => ({ erased: true }),
}));

// The phone's record of the session, kept across "launches" within a test.
let mockPhone = createMemoryStore();
jest.mock("@/services/active-session", () => {
  const actual = jest.requireActual("@/services/active-session");
  return { ...actual, activeSessionStore: () => actual.createActiveSessionStore(mockPhone) };
});
jest.mock("@/services/today-cache", () => ({
  todayCache: () => ({ read: async () => null, save: jest.fn(), erase: jest.fn() }),
}));

// ── Fixtures: 4 exercises × 3 sets, 50 kg × 10 ───────────────────────────────

function exercise(i: number): PrescribedExercise {
  return {
    sessionExerciseId: `se${i}`,
    exerciseId: `e${i}`,
    name: `Exercice ${i}`,
    category: "strength",
    equipment: null,
    muscleGroups: ["Quadriceps"],
    videoUrl: null,
    instructions: null,
    orderIndex: i,
    sets: 3,
    reps: "10",
    weightSuggestion: null,
    restSeconds: 90,
    tempo: null,
    notes: null,
    supersetGroup: null,
    lastPerformance: {
      performedAt: "2026-08-10T18:00:00Z",
      sets: [
        {
          setNumber: 1,
          repsCompleted: 10,
          weightKg: 50,
          rpe: null,
          durationSeconds: null,
          distanceMeters: null,
          isPr: false,
        },
      ],
    },
  };
}

beforeEach(() => {
  resetSharedSetQueueForTests();
  mockDisk.write("[]");
  mockPhone = createMemoryStore();
  mockToday = {
    athleteFirstName: "Félix",
    date: "2026-08-17",
    today: {
      state: "scheduled",
      session: {
        sessionId: "s1",
        name: "Force — Haut du corps",
        description: null,
        estimatedDurationMinutes: 55,
        weekNumber: 1,
        dayOfWeek: 1,
        exercises: [1, 2, 3, 4].map(exercise),
        programName: "Bloc",
        coachFirstName: null,
      },
    },
    week: { weekNumber: 1, days: [], completedCount: 0, scheduledCount: 1 },
    lastSession: null,
  };
});

async function open() {
  render(<LiveSessionScreen />);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

// ── Story 5.1 ────────────────────────────────────────────────────────────────

describe("live session · story 5.1", () => {
  it("shows the first exercise, its planned sets and the next one; goes forward; « Terminer » on the last", async () => {
    await open();
    expect(screen.getByLabelText("Exercice 1, exercice 1 sur 4")).toBeTruthy();
    expect(screen.getByText("Série 1 / 3")).toBeTruthy();
    expect(screen.getByText("Exercice 2")).toBeTruthy(); // « Exercice suivant » card

    fireEvent.press(screen.getByText("Suivant ›"));
    expect(screen.getByLabelText("Exercice 2, exercice 2 sur 4")).toBeTruthy();
    fireEvent.press(screen.getByText("Suivant ›"));
    fireEvent.press(screen.getByText("Suivant ›"));
    expect(screen.getByLabelText("Exercice 4, exercice 4 sur 4")).toBeTruthy();
    expect(screen.queryByText("Suivant ›")).toBeNull();
    expect(screen.getByText("Terminer")).toBeTruthy();
  });

  it("« Quitter » asks first and keeps what is noted", async () => {
    await open();
    for (let i = 0; i < 2; i++) {
      fireEvent.press(screen.getByText("Série terminée"));
      fireEvent.press(screen.getByText("Reprendre maintenant"));
    }
    fireEvent.press(screen.getByText("Série terminée"));
    fireEvent.press(screen.getByLabelText("Quitter la séance"));
    expect(screen.getByText("Quitter la séance ?")).toBeTruthy();
    expect(screen.getByText(/Tes 3 séries notées sont gardées/)).toBeTruthy();
    fireEvent.press(screen.getByText("Quitter"));
    expect(mockBack).toHaveBeenCalled();

    const kept = await createActiveSessionStore(mockPhone).read("me");
    expect(kept?.logged).toHaveLength(3);
  });
});

// ── Stories 5.2, 5.3, 5.4 ────────────────────────────────────────────────────

describe("live session · stories 5.2 to 5.4, without any network", () => {
  it("opens, notes a prefilled set in one touch and starts the programme's rest", async () => {
    await open();
    expect(screen.getByText("Hors ligne")).toBeTruthy();
    expect(screen.getByLabelText("10 répétitions")).toBeTruthy();
    expect(screen.getByLabelText("50 kilos")).toBeTruthy();

    fireEvent.press(screen.getByText("Série terminée"));
    expect(mockRest.start).toHaveBeenCalledWith(90);
    expect(screen.getByText("Série 1 terminée · 2 restantes")).toBeTruthy();
    expect(screen.getByText(/en attente d'envoi/)).toBeTruthy();

    fireEvent.press(screen.getByText("+30 s"));
    expect(mockRest.adjust).toHaveBeenCalledWith(30);
    fireEvent.press(screen.getByText("Reprendre maintenant"));
    expect(mockRest.cancel).toHaveBeenCalled();
    expect(screen.getByText("Série 2 / 3")).toBeTruthy();
  });

  it("refuses a weight over 999 kg and says why", async () => {
    mockToday = {
      ...mockToday,
      today: {
        state: "scheduled",
        session: {
          ...(mockToday.today as Extract<TodayScreenData["today"], { state: "scheduled" }>).session,
          exercises: [
            {
              ...exercise(1),
              lastPerformance: {
                performedAt: "x",
                sets: [
                  {
                    setNumber: 1,
                    repsCompleted: 10,
                    weightKg: 998,
                    rpe: null,
                    durationSeconds: null,
                    distanceMeters: null,
                    isPr: false,
                  },
                ],
              },
            },
          ],
        },
      } as TodayScreenData["today"],
    };
    await open();
    fireEvent.press(screen.getByLabelText("2,5 kilo de plus"));
    expect(screen.getByText("Le poids ne peut pas dépasser 999 kg.")).toBeTruthy();
    fireEvent.press(screen.getByText("Série terminée"));
    expect(screen.queryByText(/Série 1 terminée/)).toBeNull();
  });

  it("after the app is killed, the session comes back with 0 set lost", async () => {
    await open();
    fireEvent.press(screen.getByText("Série terminée"));
    fireEvent.press(screen.getByText("Reprendre maintenant"));
    fireEvent.press(screen.getByText("Série terminée"));
    screen.unmount();

    resetSharedSetQueueForTests(); // a new process: only the disk survives
    await open();
    expect(screen.getByText("Série 3 / 3")).toBeTruthy();
    expect(JSON.parse((await mockDisk.read()) ?? "[]")).toHaveLength(2);
  });
});

// ── Stories 5.5 and 5.6 ──────────────────────────────────────────────────────

describe("live session · stories 5.5 and 5.6", () => {
  it("keeps an effort, asks before finishing early, shows the recap, saves without network", async () => {
    await open();
    fireEvent.press(screen.getByText("Série terminée"));
    fireEvent.press(screen.getByLabelText("Effort 8 sur 10"));
    fireEvent.press(screen.getByText("Reprendre maintenant"));
    fireEvent.press(screen.getByText("Série terminée"));
    fireEvent.press(screen.getByText("Reprendre maintenant"));
    fireEvent.press(screen.getByText("Série terminée")); // 3/3: exercise summary
    expect(screen.getByText("Détail des séries")).toBeTruthy();
    expect(screen.getByText(/effort 8\/10/)).toBeTruthy();

    fireEvent.press(screen.getByText("Revenir à l'exercice"));
    fireEvent.press(screen.getByText("Terminer la séance"));
    expect(screen.getByText("Il reste 9 séries. Terminer quand même ?")).toBeTruthy();
    fireEvent.press(screen.getByText("Terminer quand même"));

    expect(screen.getByText("Séance terminée")).toBeTruthy();
    expect(screen.getByLabelText("3 séries sur 12")).toBeTruthy();
    expect(screen.getByLabelText("1 500 kilos au total")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Enregistrer la séance"));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByText(/Elle sera envoyée dès que le réseau revient/)).toBeTruthy();
    const kept = await createActiveSessionStore(mockPhone).read("me");
    expect(kept?.completion?.completedAt).toEqual(expect.any(String));
    expect(kept?.logged.find((l) => l.setNumber === 1)?.rpe).toBe(8);

    fireEvent.press(screen.getByText("Retour à l'accueil"));
    expect(mockReplace).toHaveBeenCalledWith("/(athlete)");
  });
});
