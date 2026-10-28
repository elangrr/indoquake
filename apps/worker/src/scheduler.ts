import type { FeedName } from "@indoquake/shared";

export const MAX_BACKOFF_MS = 120_000;
export const JITTER_RATIO = 0.2;
export const DOWN_AFTER_FAILURES = 3;
export const REQUEST_BUDGET = { maxRequests: 30, windowMs: 60_000 } as const;

/**
 * Delay before the next poll of a feed. Healthy: the base interval. After n consecutive failures:
 * min(base * 2^n, 120 s) with +-20% jitter. A Retry-After (already capped at 300 s) is a floor.
 */
export function nextDelayMs(
  baseMs: number,
  consecutiveFailures: number,
  random: () => number = Math.random,
  retryAfterMs: number | null = null,
): number {
  if (consecutiveFailures <= 0) return Math.max(baseMs, retryAfterMs ?? 0);
  const backoff = Math.min(baseMs * 2 ** consecutiveFailures, MAX_BACKOFF_MS);
  const jitter = 1 + (random() * 2 - 1) * JITTER_RATIO;
  return Math.max(Math.round(backoff * jitter), retryAfterMs ?? 0);
}

/** Sliding-window request budget: never more than maxRequests in any windowMs (failures count too). */
export class RequestBudget {
  private readonly stamps: number[] = [];

  constructor(
    private readonly maxRequests: number = REQUEST_BUDGET.maxRequests,
    private readonly windowMs: number = REQUEST_BUDGET.windowMs,
  ) {}

  /** Takes one request slot, or returns the ms to wait until one frees up. */
  take(nowMs: number): { ok: true } | { ok: false; waitMs: number } {
    while (this.stamps.length > 0 && nowMs - (this.stamps[0] as number) >= this.windowMs) {
      this.stamps.shift();
    }
    if (this.stamps.length < this.maxRequests) {
      this.stamps.push(nowMs);
      return { ok: true };
    }
    return { ok: false, waitMs: (this.stamps[0] as number) + this.windowMs - nowMs };
  }
}

export type PollOutcome = { ok: true } | { ok: false; error: string; retryAfterMs?: number | null };

export interface FeedState {
  feed: FeedName;
  intervalMs: number;
  consecutiveFailures: number;
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
}

export interface SchedulerOptions {
  intervalsMs: Record<FeedName, number>;
  poll: (feed: FeedName) => Promise<PollOutcome>;
  onAttempt?: (state: FeedState, outcome: PollOutcome) => void | Promise<void>;
  budget?: RequestBudget;
  now?: () => number;
  random?: () => number;
}

/**
 * Polls each feed on its own timer (no shared serial loop). The next poll of a feed is planned from
 * the start of the previous one, so slow responses do not add drift. Poll errors never escape.
 */
export class FeedScheduler {
  private readonly states: Map<FeedName, FeedState>;
  private readonly timers = new Map<FeedName, ReturnType<typeof setTimeout>>();
  private readonly budget: RequestBudget;
  private readonly now: () => number;
  private readonly random: () => number;
  private running = false;

  constructor(private readonly options: SchedulerOptions) {
    this.budget = options.budget ?? new RequestBudget();
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.states = new Map(
      (Object.keys(options.intervalsMs) as FeedName[]).map((feed) => [
        feed,
        {
          feed,
          intervalMs: options.intervalsMs[feed],
          consecutiveFailures: 0,
          lastOkAt: null,
          lastErrorAt: null,
          lastError: null,
        },
      ]),
    );
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    for (const feed of this.states.keys()) this.schedule(feed, 0);
  }

  stop(): void {
    this.running = false;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  snapshot(): FeedState[] {
    return [...this.states.values()].map((state) => ({ ...state }));
  }

  private schedule(feed: FeedName, delayMs: number): void {
    if (!this.running) return;
    this.timers.set(feed, setTimeout(() => void this.tick(feed), Math.max(0, delayMs)));
  }

  private async tick(feed: FeedName): Promise<void> {
    const state = this.states.get(feed);
    if (!state || !this.running) return;
    const startedAt = this.now();
    const slot = this.budget.take(startedAt);
    if (!slot.ok) {
      this.schedule(feed, slot.waitMs);
      return;
    }
    let outcome: PollOutcome;
    try {
      outcome = await this.options.poll(feed);
    } catch (error) {
      outcome = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    const finishedAt = this.now();
    if (outcome.ok) {
      state.consecutiveFailures = 0;
      state.lastOkAt = finishedAt;
    } else {
      state.consecutiveFailures += 1;
      state.lastErrorAt = finishedAt;
      state.lastError = outcome.error;
    }
    try {
      await this.options.onAttempt?.({ ...state }, outcome);
    } catch {
      // heartbeat or logging trouble must not stop polling
    }
    const delay = nextDelayMs(
      state.intervalMs,
      state.consecutiveFailures,
      this.random,
      outcome.ok ? null : (outcome.retryAfterMs ?? null),
    );
    this.schedule(feed, delay - (finishedAt - startedAt));
  }
}
