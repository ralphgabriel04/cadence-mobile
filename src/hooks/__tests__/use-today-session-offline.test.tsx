import { renderHook, waitFor } from "@testing-library/react-native";

import { useTodaySession } from "@/hooks/use-today-session";
import { createMemoryStore } from "@/services/local-store";
import { createTodayCache } from "@/services/today-cache";
import type { TodayScreenData } from "@/types/today-screen";

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ state: { status: "ready", profile: { id: "athlete-a" } } }),
}));

const mockFetch = jest.fn();
jest.mock("@/services/today-session", () => {
  const actual = jest.requireActual("@/services/today-session");
  return { ...actual, fetchTodayScreen: (...a: unknown[]) => mockFetch(...a) };
});

const data: TodayScreenData = {
  athleteFirstName: "Félix",
  date: "2026-08-18",
  today: { state: "no-active-program" },
  week: {
    weekNumber: null,
    days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, isToday: d === 2, state: "rest" })),
    completedCount: 0,
    scheduledCount: 0,
  },
  lastSession: null,
  outlook: null,
};

describe("useTodaySession offline (story 4.1)", () => {
  it("saves a fetched screen, then shows it flagged offline when the network fails", async () => {
    const cache = createTodayCache(createMemoryStore());

    mockFetch.mockResolvedValueOnce({ ok: true, data });
    const first = renderHook(() => useTodaySession({ onDate: "2026-08-18", cache }));
    await waitFor(() => expect(first.result.current.state.status).toBe("ready"));
    first.unmount();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      failure: { kind: "network", message: "offline" },
    });
    const second = renderHook(() => useTodaySession({ onDate: "2026-08-18", cache }));
    await waitFor(() => expect(second.result.current.state.status).toBe("ready"));
    const state = second.result.current.state;
    if (state.status !== "ready") throw new Error("expected ready");
    expect(state.offline?.savedAt).toEqual(expect.any(String));
    expect(state.data.athleteFirstName).toBe("Félix");
  });

  it("shows the error with Réessayer when there is no copy", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      failure: { kind: "network", message: "offline" },
    });
    const { result } = renderHook(() =>
      useTodaySession({ onDate: "2026-08-18", cache: createTodayCache(createMemoryStore()) })
    );
    await waitFor(() => expect(result.current.state.status).toBe("error"));
  });

  it("never shows the copy when the session expired", async () => {
    const cache = createTodayCache(createMemoryStore());
    cache.save("athlete-a", data);
    mockFetch.mockResolvedValueOnce({ ok: false, failure: { kind: "unauthenticated" } });
    const { result } = renderHook(() => useTodaySession({ onDate: "2026-08-18", cache }));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
  });
});
