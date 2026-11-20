import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/providers/auth-provider";
import { todayCache, type TodayCache } from "@/services/today-cache";
import { flushPendingCompletion } from "@/services/training-sync";
import {
  fetchTodayScreen,
  type TodaySessionFailure,
} from "@/services/today-session";
import type { TodayScreenData } from "@/types/today-screen";
import { localDateISO } from "@/utils/local-date";

/**
 * Same shape as the auth provider's state: a discriminated union, so a screen
 * cannot render "ready" while holding no data.
 */
export type TodaySessionState =
  | { status: "loading" }
  | { status: "refreshing"; data: TodayScreenData; offline?: OfflineInfo }
  | { status: "ready"; data: TodayScreenData; offline?: OfflineInfo }
  | { status: "error"; failure: TodaySessionFailure };

/**
 * Set when `data` is the last copy kept on the phone because the network
 * failed (story 4.1, criterion 4). `savedAt` is when that copy was fetched.
 */
export type OfflineInfo = { savedAt: string };

/**
 * Loads the home-screen payload for the athlete's local date.
 *
 * `refreshing` is distinct from `loading` so a pull-to-refresh keeps the current
 * content on screen instead of blanking it -- the first load has nothing to
 * show, a refresh does.
 *
 * Refetching when the screen regains focus is left to the screen, which knows
 * its own navigation context. This hook only reacts to the date changing, which
 * matters for an app left open past midnight: without it the athlete would still
 * be looking at yesterday's session.
 */
export function useTodaySession(options?: { onDate?: string; cache?: TodayCache }): {
  state: TodaySessionState;
  refetch: () => void;
} {
  const explicitDate = options?.onDate;
  const { state: auth } = useAuth();
  const athleteId = auth.status === "ready" ? auth.profile.id : "";
  // Held in a ref: a caller passing a fresh object each render must not retrigger the load.
  const cacheRef = useRef(options?.cache);
  const [date, setDate] = useState(() => explicitDate ?? localDateISO());
  const [state, setState] = useState<TodaySessionState>({ status: "loading" });

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A caller-supplied date wins, and changing it refetches.
  useEffect(() => {
    if (explicitDate !== undefined) setDate(explicitDate);
  }, [explicitDate]);

  // Roll over at midnight for a session left open. One minute of granularity is
  // plenty and costs nothing; a shorter interval would wake the device for no
  // reason.
  useEffect(() => {
    if (explicitDate !== undefined) return;
    const id = setInterval(() => {
      const today = localDateISO();
      setDate((current) => (current === today ? current : today));
    }, 60_000);
    return () => clearInterval(id);
  }, [explicitDate]);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      setState((current) =>
        mode === "refresh" && (current.status === "ready" || current.status === "refreshing")
          ? { status: "refreshing", data: current.data }
          : { status: "loading" },
      );

      // A session finished without network goes out first (story 5.5,
      // criterion 5), so the screen below can already show it as done.
      if (athleteId) await flushPendingCompletion(athleteId).catch(() => undefined);
      if (!mounted.current) return;

      const result = await fetchTodayScreen({ onDate: date });
      if (!mounted.current) return;

      const store = cacheRef.current ?? safeCache();
      if (result.ok) {
        store?.save(athleteId, result.data);
        setState({ status: "ready", data: result.data });
        return;
      }

      // No network: show the last copy this account fetched, flagged offline.
      // Only for a network failure -- an expired session must not show data.
      if (result.failure.kind === "network" && store) {
        const cached = await store.read(athleteId);
        if (!mounted.current) return;
        if (cached) {
          setState({ status: "ready", data: cached.data, offline: { savedAt: cached.savedAt } });
          return;
        }
      }
      setState({ status: "error", failure: result.failure });
    },
    [date, athleteId],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  const refetch = useCallback(() => {
    void load("refresh");
  }, [load]);

  return { state, refetch };
}

/** The shared cache, or null when the device storage cannot be opened. */
function safeCache(): TodayCache | null {
  try {
    return todayCache();
  } catch {
    return null;
  }
}
