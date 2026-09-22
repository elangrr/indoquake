import type { Logger } from "pino";
import {
  fetchBmkgFeed,
  parseFeedPayload,
  type BmkgFeedName,
  type NormalizedEarthquake,
} from "@indoquake/bmkg";
import type { Database } from "@indoquake/database";
import { upsertEarthquake } from "./store";

const FEEDS: BmkgFeedName[] = ["autogempa", "gempaterkini", "gempadirasakan"];

const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

export interface EventChange {
  type: "new" | "updated";
  event: NormalizedEarthquake;
}

export type ChangeHandler = (change: EventChange) => void | Promise<void>;

export interface FeedStatus {
  fetched: boolean;
  events: number;
  error?: string;
}

export interface CycleSummary {
  at: string;
  ok: boolean;
  inserted: number;
  updated: number;
  unchanged: number;
  durationMs: number;
  feeds: Record<BmkgFeedName, FeedStatus>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  feed: BmkgFeedName,
  logger: Logger,
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchBmkgFeed(feed, { timeoutMs: FETCH_TIMEOUT_MS });
    } catch (error) {
      lastError = error;
      const backoffMs =
        1000 * 2 ** (attempt - 1) + Math.round(Math.random() * 250);
      logger.warn({ feed, attempt, backoffMs, err: error }, "bmkg_fetch_retry");
      if (attempt < FETCH_ATTEMPTS) await sleep(backoffMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function runCycle(
  db: Database,
  logger: Logger,
  onChange?: ChangeHandler,
): Promise<CycleSummary> {
  const startedAt = Date.now();
  const summary: CycleSummary = {
    at: new Date().toISOString(),
    ok: true,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    durationMs: 0,
    feeds: {
      autogempa: { fetched: false, events: 0 },
      gempaterkini: { fetched: false, events: 0 },
      gempadirasakan: { fetched: false, events: 0 },
    },
  };

  for (const feed of FEEDS) {
    try {
      const payload = await fetchWithRetry(feed, logger);
      const events = parseFeedPayload(payload, feed);
      summary.feeds[feed] = { fetched: true, events: events.length };
      for (const event of events) {
        const result = await upsertEarthquake(db, event);
        if (result === "inserted") {
          summary.inserted += 1;
          logger.info(
            {
              feed,
              key: event.eventKey,
              magnitude: event.magnitude,
              region: event.regionName,
            },
            "earthquake_new",
          );
          await onChange?.({ type: "new", event });
        } else if (result === "updated") {
          summary.updated += 1;
          logger.info(
            { feed, key: event.eventKey, magnitude: event.magnitude },
            "earthquake_updated",
          );
          await onChange?.({ type: "updated", event });
        } else {
          summary.unchanged += 1;
        }
      }
    } catch (error) {
      summary.ok = false;
      summary.feeds[feed] = {
        fetched: false,
        events: 0,
        error: error instanceof Error ? error.message : String(error),
      };
      logger.error({ feed, err: error }, "bmkg_fetch_failed");
    }
  }

  summary.durationMs = Date.now() - startedAt;
  logger.info(
    {
      inserted: summary.inserted,
      updated: summary.updated,
      unchanged: summary.unchanged,
      durationMs: summary.durationMs,
      ok: summary.ok,
    },
    "cycle_done",
  );
  return summary;
}
