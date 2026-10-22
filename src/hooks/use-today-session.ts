import { useCallback, useEffect, useRef, useState } from "react";

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
  | { status: "refreshing"; data: TodayScreenData }
  | { status: "ready"; data: TodayScreenData }
  | { status: "error"; failure: TodaySessionFailure };

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
export function useTodaySession(options?: { onDate?: string }): {
  state: TodaySessionState;
  refetch: () => void;
} {
  const explicitDate = options?.onDate;
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

      const result = await fetchTodayScreen({ onDate: date });
      if (!mounted.current) return;

      setState(
        result.ok
          ? { status: "ready", data: result.data }
          : { status: "error", failure: result.failure },
      );
    },
    [date],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  const refetch = useCallback(() => {
    void load("refresh");
  }, [load]);

  return { state, refetch };
}
