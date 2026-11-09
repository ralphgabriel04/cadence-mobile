import { act, renderHook } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import { useWorkoutSession } from "@/hooks/use-workout-session";
import { createMemoryStorage, type QueuedSet } from "@/services/set-queue";

// The disk the queue reads on launch. A previous run left it behind.
const mockDisk = createMemoryStorage();
const mockErase = jest.fn(() => ({ erased: false }));
jest.mock("@/services/queue-storage", () => ({
  createQueueStorage: () => mockDisk,
  eraseQueueFile: () => mockErase(),
}));

const mockSendSet = jest.fn();
jest.mock("@/services/workout-session", () => ({
  startSession: jest.fn(async () => ({ ok: true, sessionLogId: "sl-1" })),
  loadInProgressSession: jest.fn(async () => ({ ok: true, sessionLogId: null })),
  completeSession: jest.fn(),
  sendSet: (...a: unknown[]) => mockSendSet(...a),
}));

// The real guard, unless a test replaces it.
const mockGuard = jest.fn();
jest.mock("@/services/purge-local-queue", () => {
  const actual = jest.requireActual("@/services/purge-local-queue");
  return { ...actual, mayRestoreLocalQueue: () => mockGuard() };
});

function validSet(overrides: Partial<QueuedSet> = {}): QueuedSet {
  return {
    clientId: "c-old",
    sessionLogId: "sl-old",
    exerciseId: "ex-1",
    sessionExerciseId: "se-1",
    setNumber: 1,
    repsCompleted: 10,
    weightKg: 60,
    rpe: null,
    durationSeconds: null,
    distanceMeters: null,
    notes: null,
    queuedAt: "2026-08-17T18:00:00.000Z",
    lastAttemptAt: null,
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

async function launch(athleteId: string) {
  const hook = renderHook(() => useWorkoutSession({ sessionId: "s", athleteId, exercises: [] }));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  return hook;
}

beforeEach(() => {
  mockDisk.write("[]");
  mockSendSet.mockReset().mockResolvedValue({ ok: true });
  mockErase.mockReset().mockReturnValue({ erased: false });
  mockGuard
    .mockReset()
    .mockImplementation(() =>
      jest.requireActual("@/services/purge-local-queue").mayRestoreLocalQueue()
    );
  (SecureStore.getItemAsync as jest.Mock).mockReset().mockResolvedValue(null);
});

describe("useWorkoutSession · what it reloads on launch", () => {
  it("normal case: the signed-in account's own unsent set is reloaded and sent", async () => {
    mockDisk.write(JSON.stringify([validSet({ ownerId: "me" })]));
    await launch("me");
    expect(mockSendSet).toHaveBeenCalledTimes(1);
  });

  it("a valid set left by ANOTHER account is neither reloaded nor sent, and the file is overwritten", async () => {
    mockDisk.write(JSON.stringify([validSet({ ownerId: "deleted-account" })]));
    const { result } = await launch("me");
    expect(mockSendSet).not.toHaveBeenCalled();
    expect(result.current.pendingCount).toBe(0);
    expect(await mockDisk.read()).not.toContain("deleted-account");
  });

  it("a set with no owner (written before owners existed) is not trusted either", async () => {
    mockDisk.write(JSON.stringify([validSet()]));
    await launch("me");
    expect(mockSendSet).not.toHaveBeenCalled();
  });

  it("keychain read rejected at launch: the old account's valid set is still not sent", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error("keychain locked"));
    mockDisk.write(JSON.stringify([validSet({ ownerId: "deleted-account" })]));
    await launch("me");
    expect(mockSendSet).not.toHaveBeenCalled();
  });

  it("marker write had failed (keychain holds nothing), new process: still not sent", async () => {
    mockDisk.write(JSON.stringify([validSet({ ownerId: "deleted-account" })]));
    await launch("me"); // fresh process: the keychain read returns null
    expect(mockSendSet).not.toHaveBeenCalled();
  });

  it("refused purge still outstanding (guard says no): nothing is reloaded, even the same owner's", async () => {
    mockGuard.mockResolvedValue(false);
    mockDisk.write(JSON.stringify([validSet({ ownerId: "me" })]));
    const { result } = await launch("me");
    expect(mockSendSet).not.toHaveBeenCalled();
    expect(result.current.pendingCount).toBe(0);
  });

  it("a set validated on screen is stamped with the signed-in account", async () => {
    // Covered at queue level (set-queue.test.ts: stamps the owner); here only the wiring.
    mockDisk.write(JSON.stringify([validSet({ ownerId: "me", clientId: "mine" })]));
    await launch("me");
    expect(mockSendSet.mock.calls[0][0]).toMatchObject({ clientId: "mine", ownerId: "me" });
  });
});
