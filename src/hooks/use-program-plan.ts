import { useCallback, useEffect, useRef, useState } from "react";

import { fetchProgramPlan } from "@/services/program-plan";
import type { ProgramPlanFailure, ProgramPlanState } from "@/types/program-plan";
import { localDateISO } from "@/utils/local-date";

export type ProgramPlanViewState =
  | { status: "loading" }
  | { status: "refreshing"; plan: ProgramPlanState }
  | { status: "ready"; plan: ProgramPlanState }
  | { status: "error"; failure: ProgramPlanFailure };

/**
 * Loads the athlete's full plan.
 *
 * Same shape as useTodaySession: `refreshing` keeps the current content on
 * screen during a pull-to-refresh instead of blanking it, and the union means a
 * screen cannot render "ready" while holding nothing.
 *
 * No midnight rollover here, unlike the home screen. The plan changes state at
 * most once a day and the whole view is scrolled manually, so a timer would wake
 * the device to redraw a screen nobody is looking at. `refetch` on focus is the
 * screen's job.
 */
export function useProgramPlan(options?: { onDate?: string }): {
  state: ProgramPlanViewState;
  refetch: () => void;
} {
  const onDate = options?.onDate;
  const [state, setState] = useState<ProgramPlanViewState>({ status: "loading" });

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      setState((current) =>
        mode === "refresh" && (current.status === "ready" || current.status === "refreshing")
          ? { status: "refreshing", plan: current.plan }
          : { status: "loading" },
      );

      const result = await fetchProgramPlan({ onDate: onDate ?? localDateISO() });
      if (!mounted.current) return;

      setState(
        result.ok
          ? { status: "ready", plan: result.state }
          : { status: "error", failure: result.failure },
      );
    },
    [onDate],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  const refetch = useCallback(() => {
    void load("refresh");
  }, [load]);

  return { state, refetch };
}
