import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedScheduler, nextDelayMs, RequestBudget, type PollOutcome } from "../src/scheduler";

const INTERVALS = { autogempa: 10_000, gempaterkini: 20_000, gempadirasakan: 30_000 };

function countingScheduler(outcome: PollOutcome) {
  const calls = { autogempa: 0, gempaterkini: 0, gempadirasakan: 0 };
  const scheduler = new FeedScheduler({
    intervalsMs: INTERVALS,
    random: () => 0.5,
    poll: async (feed) => {
      calls[feed] += 1;
      return outcome;
    },
  });
  return { calls, scheduler };
}

describe("nextDelayMs (A-08)", () => {
  it.each([
    [0, 0.5, 10_000],
    [1, 0.5, 20_000],
    [2, 0.5, 40_000],
    [3, 0.5, 80_000],
    [4, 0.5, 120_000],
    [9, 0.5, 120_000],
    [1, 0, 16_000],
    [1, 1, 24_000],
    [5, 1, 144_000],
  ])("after %i failures with random %s waits %i ms", (failures, random, expected) => {
    expect(nextDelayMs(10_000, failures, () => random)).toBe(expected);
  });

  it("treats a Retry-After of 90 s as a floor", () => {
    expect(nextDelayMs(10_000, 1, () => 0.5, 90_000)).toBe(90_000);
  });
});

describe("RequestBudget", () => {
  it("allows 30 requests per sliding 60 s window and says when the next slot frees", () => {
    const budget = new RequestBudget(30, 60_000);
    const results = Array.from({ length: 31 }, (_unused, index) => budget.take(index * 100).ok);
    expect(results.filter(Boolean)).toHaveLength(30);
    expect(budget.take(3_100)).toEqual({ ok: false, waitMs: 56_900 });
    expect(budget.take(60_000)).toEqual({ ok: true });
  });
});

describe("FeedScheduler (A-08, A-10)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("polls each healthy feed at its own rate over 60 s", async () => {
    const { calls, scheduler } = countingScheduler({ ok: true });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(59_999);
    scheduler.stop();
    expect(calls).toEqual({ autogempa: 6, gempaterkini: 3, gempadirasakan: 2 });
  });

  it("backs off under constant failure and never exceeds the budget", async () => {
    const { calls, scheduler } = countingScheduler({ ok: false, error: "HTTP 503" });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(59_999);
    scheduler.stop();
    expect(calls).toEqual({ autogempa: 2, gempaterkini: 2, gempadirasakan: 1 });
    expect(scheduler.snapshot().map((state) => state.consecutiveFailures)).toEqual([2, 2, 1]);
  });

  it("holds a feed at least 90 s after a 429 with Retry-After: 90", async () => {
    const { calls, scheduler } = countingScheduler({ ok: false, error: "HTTP 429", retryAfterMs: 90_000 });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(89_999);
    scheduler.stop();
    expect(calls.autogempa).toBe(1);
  });

  it("resets the delay on the first success", async () => {
    const outcomes: PollOutcome[] = [{ ok: false, error: "x" }, { ok: false, error: "x" }, { ok: true }];
    const scheduler = new FeedScheduler({
      intervalsMs: { autogempa: 10_000 } as typeof INTERVALS,
      random: () => 0.5,
      poll: async () => outcomes.shift() ?? { ok: true },
    });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(20_000 + 40_000);
    expect(scheduler.snapshot()[0]?.consecutiveFailures).toBe(0);
    scheduler.stop();
  });

  it("keeps running when poll throws", async () => {
    const scheduler = new FeedScheduler({
      intervalsMs: { autogempa: 10_000 } as typeof INTERVALS,
      random: () => 0.5,
      poll: async () => {
        throw new Error("boom");
      },
    });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(30_000);
    scheduler.stop();
    expect(scheduler.snapshot()[0]).toMatchObject({ consecutiveFailures: 2, lastError: "boom" });
  });

  it("caps a burst of fast feeds at 30 requests per minute", async () => {
    const fast = { autogempa: 1_000, gempaterkini: 1_000, gempadirasakan: 1_000 };
    let total = 0;
    const scheduler = new FeedScheduler({
      intervalsMs: fast,
      random: () => 0.5,
      poll: async () => {
        total += 1;
        return { ok: true };
      },
    });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(59_999);
    scheduler.stop();
    expect(total).toBe(30);
  });
});
