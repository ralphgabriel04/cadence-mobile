// ============================================================================
// Rest timer between sets (cm#27)
//
// THE ONE DECISION THAT MATTERS
// The timer stores an ABSOLUTE END INSTANT, never a decrementing counter.
//
// A counter driven by setInterval is wrong the moment the app leaves the
// foreground: iOS suspends JavaScript timers, so an athlete who locks their
// phone for ninety seconds of rest comes back to a timer that barely moved. The
// intervals below exist only to repaint the display -- if every one of them is
// dropped, the remaining time is still correct, because it is derived from the
// clock rather than accumulated by it.
//
// That also makes the whole thing pure and testable: every function takes `now`
// as an argument, so "what happens across three minutes in the background" is a
// unit test, not a manual experiment with a stopwatch.
// ============================================================================

export type RestTimer =
  /** No rest in progress. */
  | { status: "idle" }
  /** Counting down towards `endsAt`. */
  | { status: "running"; endsAt: number; totalSeconds: number }
  /**
   * The rest elapsed. Distinct from idle so the UI can announce it once and the
   * athlete can see that it finished rather than simply finding it gone.
   */
  | { status: "finished"; endsAt: number; totalSeconds: number };

export const IDLE_TIMER: RestTimer = { status: "idle" };

/** The +/- step offered next to the countdown. */
export const REST_ADJUST_SECONDS = 15;

/** Used when a prescription carries no rest value. */
export const DEFAULT_REST_SECONDS = 90;

export function startRest(totalSeconds: number, now: number): RestTimer {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds === 0) {
    // A prescription of zero rest means no rest, not an instantly-finished
    // timer that would fire a notification for nothing.
    return IDLE_TIMER;
  }
  return { status: "running", endsAt: now + seconds * 1000, totalSeconds: seconds };
}

/**
 * Whole seconds left, never negative.
 *
 * Rounded UP so the display shows "1" for the last fractional second rather
 * than sitting on "0" while the timer is still running -- a countdown that
 * reads zero but has not fired looks broken.
 */
export function remainingSeconds(timer: RestTimer, now: number): number {
  if (timer.status !== "running") return 0;
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

/** 0 to 1, for a progress ring. */
export function elapsedFraction(timer: RestTimer, now: number): number {
  if (timer.status === "idle") return 0;
  if (timer.status === "finished") return 1;
  if (timer.totalSeconds === 0) return 1;
  const remaining = (timer.endsAt - now) / 1000;
  return Math.min(1, Math.max(0, 1 - remaining / timer.totalSeconds));
}

/**
 * Advances the timer to `now`.
 *
 * This is the whole backgrounding story: whether it is called every second or
 * once after four minutes away, the outcome is the same, because the answer
 * comes from comparing two instants rather than from counting ticks.
 */
export function tickRest(timer: RestTimer, now: number): RestTimer {
  if (timer.status !== "running") return timer;
  if (now < timer.endsAt) return timer;
  return { status: "finished", endsAt: timer.endsAt, totalSeconds: timer.totalSeconds };
}

/**
 * Adds or removes time.
 *
 * Shortening below the current instant finishes the timer immediately rather
 * than producing a negative countdown -- pressing "-15 s" with ten seconds left
 * means "I am done resting".
 *
 * Extending a FINISHED timer restarts it from now. The alternative, refusing,
 * would leave the athlete no way to say "actually, thirty seconds more" without
 * starting a fresh rest, which is the same thing with more taps.
 */
export function adjustRest(timer: RestTimer, deltaSeconds: number, now: number): RestTimer {
  if (timer.status === "idle") {
    return deltaSeconds > 0 ? startRest(deltaSeconds, now) : IDLE_TIMER;
  }

  if (timer.status === "finished") {
    return deltaSeconds > 0 ? startRest(deltaSeconds, now) : IDLE_TIMER;
  }

  const endsAt = timer.endsAt + deltaSeconds * 1000;
  if (endsAt <= now) {
    return { status: "finished", endsAt: now, totalSeconds: timer.totalSeconds };
  }

  return {
    status: "running",
    endsAt,
    // The total grows with the extension so the progress ring stays truthful
    // instead of jumping backwards past its own start.
    totalSeconds: Math.max(timer.totalSeconds, Math.ceil((endsAt - now) / 1000)),
  };
}

/** Cancelling returns to idle, with no completion signal. */
export function cancelRest(): RestTimer {
  return IDLE_TIMER;
}

/** `"1:30"`, or `"0:07"`. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
