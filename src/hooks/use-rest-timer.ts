import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import {
  adjustRest,
  cancelRest,
  elapsedFraction,
  IDLE_TIMER,
  remainingSeconds,
  startRest,
  tickRest,
  type RestTimer,
} from "@/features/training/rest-timer";
import {
  cancelRestEnd,
  prepareRestNotifications,
  pulseAdjust,
  pulseRestEnd,
  scheduleRestEnd,
} from "@/features/training/rest-signals";

/**
 * Rest timer between sets (cm#27).
 *
 * The countdown itself is pure and lives in rest-timer.ts. This hook adds the
 * three things that need the platform:
 *
 *   1. a display refresh, which is ONLY a repaint -- dropping every tick leaves
 *      the remaining time correct, because it is derived from the clock;
 *   2. an AppState listener, so returning from the background recomputes
 *      immediately instead of waiting up to a second for the next interval;
 *   3. the scheduled notification, booked with the OS at start and cancelled if
 *      the athlete ends the rest early.
 *
 * It never blocks anything. The athlete can validate the next set while the
 * countdown runs -- resting is a suggestion, not a modal.
 */
export function useRestTimer(options?: { onFinish?: () => void }) {
  const onFinish = options?.onFinish;

  const [timer, setTimer] = useState<RestTimer>(IDLE_TIMER);
  const [now, setNow] = useState(() => Date.now());
  const [notificationsReady, setNotificationsReady] = useState<boolean | null>(null);

  const notificationId = useRef<string | null>(null);
  /** Guards against announcing the same rest twice. */
  const announcedFor = useRef<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Permission is requested once, at mount, rather than at the first rest: an
  // OS dialog appearing the instant the athlete finishes their first set would
  // interrupt exactly the moment cm#25 is trying to keep to three seconds.
  useEffect(() => {
    void prepareRestNotifications().then((granted) => {
      if (mounted.current) setNotificationsReady(granted);
    });
  }, []);

  // Repaint once a second, and only while there is something to repaint.
  useEffect(() => {
    if (timer.status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer.status]);

  // Coming back from the background: recompute immediately. Without this the
  // countdown would show a stale value for up to a second -- and on a rest that
  // ended while away, the athlete would briefly see time still on the clock.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active" && mounted.current) setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  // Transition to finished, and announce it once.
  useEffect(() => {
    const advanced = tickRest(timer, now);
    if (advanced === timer) return;

    setTimer(advanced);

    if (advanced.status === "finished" && announcedFor.current !== advanced.endsAt) {
      announcedFor.current = advanced.endsAt;
      // Haptic only: the scheduled notification covers the case where the app
      // is not in front, and firing both here would double up.
      void pulseRestEnd();
      onFinish?.();
    }
  }, [timer, now, onFinish]);

  const start = useCallback(async (seconds: number) => {
    const at = Date.now();
    const next = startRest(seconds, at);

    await cancelRestEnd(notificationId.current);
    notificationId.current = null;

    if (next.status === "running") {
      announcedFor.current = null;
      notificationId.current = await scheduleRestEnd(seconds);
    }

    if (mounted.current) {
      setNow(at);
      setTimer(next);
    }
  }, []);

  const adjust = useCallback(
    async (deltaSeconds: number) => {
      const at = Date.now();
      const next = adjustRest(timer, deltaSeconds, at);

      // The booked notification is always replaced rather than patched: the OS
      // has no notion of "move this by fifteen seconds".
      await cancelRestEnd(notificationId.current);
      notificationId.current =
        next.status === "running" ? await scheduleRestEnd(remainingSeconds(next, at)) : null;

      if (next.status === "running") announcedFor.current = null;
      void pulseAdjust();

      if (mounted.current) {
        setNow(at);
        setTimer(next);
      }
    },
    [timer],
  );

  const cancel = useCallback(async () => {
    await cancelRestEnd(notificationId.current);
    notificationId.current = null;
    // Cancelling is silent by design: the athlete chose to stop resting, and a
    // buzz confirming it would be one more thing to ignore.
    announcedFor.current = null;
    if (mounted.current) setTimer(cancelRest());
  }, []);

  // A rest still booked when the screen unmounts would fire long after the
  // session ended.
  useEffect(() => {
    return () => {
      void cancelRestEnd(notificationId.current);
    };
  }, []);

  return {
    timer,
    remaining: remainingSeconds(timer, now),
    progress: elapsedFraction(timer, now),
    isResting: timer.status === "running",
    isFinished: timer.status === "finished",
    /**
     * false when the athlete declined notifications: the UI says so, rather
     * than letting them discover it by missing a rest with the screen off.
     */
    notificationsReady,
    start,
    adjust,
    cancel,
  };
}
