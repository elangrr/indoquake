import type { Logger } from "pino";
import { BmkgHttpError, fetchBmkgFeed, parseFeedPayload } from "@indoquake/bmkg";
import type { Database } from "@indoquake/database";
import type { EarthquakeEvent, EarthquakeStreamPayload, FeedName } from "@indoquake/shared";
import type { PollOutcome } from "./scheduler";
import { upsertEarthquake } from "./store";

export interface IngestTotals {
  inserted: number;
  updated: number;
  unchanged: number;
}

export interface FeedPollerDeps {
  db: Database;
  logger: Logger;
  baseUrl: string;
  /** Best effort, called after commit; failures are logged, the event_log row stays the source of truth. */
  publish: (payload: EarthquakeStreamPayload) => Promise<void>;
  notify: (event: EarthquakeEvent) => Promise<void>;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface FeedPoller {
  poll: (feed: FeedName) => Promise<PollOutcome>;
  totals: IngestTotals;
}

/**
 * One poll of one feed: conditional GET, parse, store each record in its own transaction, then
 * publish and notify outside the transaction. A 304 is a successful poll with nothing to parse.
 */
export function createFeedPoller(deps: FeedPollerDeps): FeedPoller {
  const validators = new Map<FeedName, { etag: string | null; lastModified: string | null }>();
  const totals: IngestTotals = { inserted: 0, updated: 0, unchanged: 0 };
  const now = deps.now ?? Date.now;
  const { logger } = deps;

  async function poll(feed: FeedName): Promise<PollOutcome> {
    let response;
    try {
      response = await fetchBmkgFeed(feed, {
        baseUrl: deps.baseUrl,
        etag: validators.get(feed)?.etag,
        lastModified: validators.get(feed)?.lastModified,
        fetchImpl: deps.fetchImpl,
        now,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ feed, err: message }, "bmkg_fetch_failed");
      return {
        ok: false,
        error: message,
        retryAfterMs:
          error instanceof BmkgHttpError && error.retryAfterSeconds !== null
            ? error.retryAfterSeconds * 1000
            : null,
      };
    }
    if (response.status === "not-modified") return { ok: true };

    const parsed = parseFeedPayload(response.payload, feed);
    if (parsed.skipped > 0) {
      logger.warn({ feed, skipped: parsed.skipped, reasons: parsed.skipReasons }, "bmkg_item_skipped");
    }
    for (const warning of parsed.warnings) logger.warn({ feed, warning }, "time_mismatch");

    let stored = true;
    for (const event of parsed.events) {
      try {
        const outcome = await upsertEarthquake(deps.db, event, { now: now() });
        totals[outcome.result] += 1;
        if (outcome.merge) logger.info({ feed, ...outcome.merge }, "dedup merge");
        if (outcome.result !== "unchanged") {
          logger.info(
            { feed, key: outcome.event.eventKey, result: outcome.result, announce: outcome.announce, seq: outcome.seq },
            outcome.result === "inserted" ? "earthquake_new" : "earthquake_updated",
          );
        }
        if (outcome.payload) {
          await deps.publish(outcome.payload).catch((error: unknown) => {
            logger.warn({ feed, seq: outcome.seq, err: String(error) }, "publish_failed");
          });
        }
        if (outcome.notify) {
          await deps.notify(outcome.event).catch((error: unknown) => {
            logger.warn({ feed, key: outcome.event.eventKey, err: String(error) }, "notify_failed");
          });
        }
      } catch (error) {
        stored = false;
        logger.error({ feed, key: event.eventKey, err: String(error) }, "store_failed");
      }
    }
    // Keep the validators only when everything was stored, so a failed write is re-fetched in full.
    if (stored) validators.set(feed, { etag: response.etag, lastModified: response.lastModified });
    return { ok: true };
  }

  return { poll, totals };
}
