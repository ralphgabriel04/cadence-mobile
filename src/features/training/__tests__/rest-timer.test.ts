import {
  adjustRest,
  cancelRest,
  DEFAULT_REST_SECONDS,
  elapsedFraction,
  formatCountdown,
  IDLE_TIMER,
  REST_ADJUST_SECONDS,
  remainingSeconds,
  startRest,
  tickRest,
  type RestTimer,
} from "../rest-timer";

const T0 = 1_800_000_000_000; // an arbitrary fixed instant
const s = (n: number) => n * 1000;

describe("startRest", () => {
  it("counts down from the prescribed duration", () => {
    const timer = startRest(90, T0);
    expect(timer.status).toBe("running");
    expect(remainingSeconds(timer, T0)).toBe(90);
  });

  it("stays idle for a prescription of zero", () => {
    // Zero rest means no rest -- not a timer that finishes instantly and fires
    // a completion signal for nothing.
    expect(startRest(0, T0)).toEqual(IDLE_TIMER);
    expect(startRest(-30, T0)).toEqual(IDLE_TIMER);
  });
});

describe("remainingSeconds", () => {
  it("decreases with the clock", () => {
    const timer = startRest(90, T0);
    expect(remainingSeconds(timer, T0 + s(30))).toBe(60);
    expect(remainingSeconds(timer, T0 + s(89))).toBe(1);
  });

  it("rounds up, so a running timer never displays zero", () => {
    // A countdown reading 0 while still running looks broken.
    const timer = startRest(10, T0);
    expect(remainingSeconds(timer, T0 + 9_500)).toBe(1);
  });

  it("never goes negative", () => {
    const timer = startRest(10, T0);
    expect(remainingSeconds(timer, T0 + s(600))).toBe(0);
  });

  it("is zero when idle or finished", () => {
    expect(remainingSeconds(IDLE_TIMER, T0)).toBe(0);
    expect(remainingSeconds(tickRest(startRest(5, T0), T0 + s(10)), T0)).toBe(0);
  });
});

// ── The reason this module exists ────────────────────────────────────────────

describe("backgrounding", () => {
  it("is correct after a long gap with no ticks at all", () => {
    // iOS suspends JavaScript timers. An athlete who locks their phone for the
    // whole rest gets ZERO intervals. A decrementing counter would come back
    // barely moved; an absolute end instant comes back correct.
    const timer = startRest(90, T0);
    const afterLock = tickRest(timer, T0 + s(120));

    expect(afterLock.status).toBe("finished");
    expect(remainingSeconds(afterLock, T0 + s(120))).toBe(0);
  });

  it("gives the same answer whether ticked every second or once at the end", () => {
    const start = startRest(60, T0);

    let ticked: RestTimer = start;
    for (let i = 1; i <= 60; i++) ticked = tickRest(ticked, T0 + s(i));

    const once = tickRest(start, T0 + s(60));

    expect(ticked).toEqual(once);
  });

  it("still reports time left when the app returns mid-rest", () => {
    const timer = startRest(180, T0);
    const back = tickRest(timer, T0 + s(45));

    expect(back.status).toBe("running");
    expect(remainingSeconds(back, T0 + s(45))).toBe(135);
  });

  it("does not finish early when the clock has not reached the end", () => {
    const timer = startRest(90, T0);
    expect(tickRest(timer, T0 + s(89)).status).toBe("running");
    expect(tickRest(timer, T0 + s(90)).status).toBe("finished");
  });
});

describe("adjustRest", () => {
  it("adds time to a running timer", () => {
    const timer = startRest(60, T0);
    const longer = adjustRest(timer, REST_ADJUST_SECONDS, T0 + s(10));
    expect(remainingSeconds(longer, T0 + s(10))).toBe(65);
  });

  it("removes time", () => {
    const timer = startRest(60, T0);
    const shorter = adjustRest(timer, -REST_ADJUST_SECONDS, T0 + s(10));
    expect(remainingSeconds(shorter, T0 + s(10))).toBe(35);
  });

  it("finishes rather than going negative when shortened past the end", () => {
    // "-15 s" with ten seconds left means "I am done resting".
    const timer = startRest(60, T0);
    const finished = adjustRest(timer, -30, T0 + s(50));
    expect(finished.status).toBe("finished");
    expect(remainingSeconds(finished, T0 + s(50))).toBe(0);
  });

  it("restarts a finished timer when time is added", () => {
    // Refusing would leave no way to say "actually, thirty seconds more"
    // without starting a fresh rest -- the same thing with more taps.
    const finished = tickRest(startRest(30, T0), T0 + s(40));
    const again = adjustRest(finished, 30, T0 + s(40));

    expect(again.status).toBe("running");
    expect(remainingSeconds(again, T0 + s(40))).toBe(30);
  });

  it("starts a rest from idle when time is added", () => {
    const started = adjustRest(IDLE_TIMER, 60, T0);
    expect(started.status).toBe("running");
    expect(remainingSeconds(started, T0)).toBe(60);
  });

  it("stays idle when time is removed from nothing", () => {
    expect(adjustRest(IDLE_TIMER, -15, T0)).toEqual(IDLE_TIMER);
  });

  it("keeps the progress ring truthful when extended", () => {
    // The total grows with the extension, so the ring cannot jump backwards
    // past its own starting point.
    const timer = startRest(30, T0);
    const longer = adjustRest(timer, 60, T0 + s(20));
    expect(elapsedFraction(longer, T0 + s(20))).toBeGreaterThanOrEqual(0);
    expect(elapsedFraction(longer, T0 + s(20))).toBeLessThanOrEqual(1);
  });
});

describe("elapsedFraction", () => {
  it("runs from 0 to 1 across the rest", () => {
    const timer = startRest(100, T0);
    expect(elapsedFraction(timer, T0)).toBeCloseTo(0);
    expect(elapsedFraction(timer, T0 + s(50))).toBeCloseTo(0.5);
    expect(elapsedFraction(timer, T0 + s(100))).toBeCloseTo(1);
  });

  it("clamps outside the interval", () => {
    const timer = startRest(100, T0);
    expect(elapsedFraction(timer, T0 - s(50))).toBe(0);
    expect(elapsedFraction(timer, T0 + s(500))).toBe(1);
  });

  it("is 0 when idle and 1 when finished", () => {
    expect(elapsedFraction(IDLE_TIMER, T0)).toBe(0);
    expect(elapsedFraction(tickRest(startRest(5, T0), T0 + s(9)), T0)).toBe(1);
  });
});

describe("cancelRest", () => {
  it("returns to idle with no completion signal", () => {
    expect(cancelRest()).toEqual(IDLE_TIMER);
  });
});

describe("formatCountdown", () => {
  it("formats minutes and seconds", () => {
    expect(formatCountdown(90)).toBe("1:30");
    expect(formatCountdown(7)).toBe("0:07");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(600)).toBe("10:00");
  });

  it("never renders a negative countdown", () => {
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("defaults", () => {
  it("falls back to a sane rest when the prescription has none", () => {
    expect(DEFAULT_REST_SECONDS).toBe(90);
    expect(startRest(DEFAULT_REST_SECONDS, T0).status).toBe("running");
  });
});
