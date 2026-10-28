import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import pino from "pino";
import { createDb } from "@indoquake/database";
import { MIGRATIONS_FOLDER, runMigrations, type RunMigrationsOptions } from "@indoquake/database/migrate";
import { BMKG_ATTRIBUTION, EVENT_CHANNEL, type FeedName } from "@indoquake/shared";
import { backfillProvinces } from "./backfill";
import { loadConfig } from "./env";
import { buildHeartbeat, createRedis, writeHeartbeat } from "./heartbeat";
import { createFeedPoller } from "./ingest";
import { acquireLeadership } from "./leader";
import { notifySubscriptions } from "./notify";
import { createRetentionJob, RETENTION_INTERVAL_MS } from "./retention";
import { FeedScheduler } from "./scheduler";
import { startTelegramBot } from "./telegram-bot";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const config = loadConfig();
const logger = pino({ level: config.logLevel });
const command = process.argv[2];
// The first DB connect is retried while Postgres is still starting (compose start order, A-M1).
const migrateOptions: RunMigrationsOptions = {
  retry: { onRetry: (retry) => logger.warn(retry, "migrate_connect_retry") },
};

async function migrateOnly(): Promise<void> {
  await runMigrations(config.databaseUrl, MIGRATIONS_FOLDER, migrateOptions);
  logger.info("migrations_applied");
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  logger.info(
    { pollIntervalsSeconds: config.pollIntervalsSeconds, retentionDays: config.retentionDays },
    "worker_started",
  );
  console.log(BMKG_ATTRIBUTION);

  // Start order (SPEC 5): migrations under an advisory lock, province backfill, then the scheduler.
  await runMigrations(config.databaseUrl, MIGRATIONS_FOLDER, migrateOptions);
  const { sql, db } = createDb(config.databaseUrl);
  const backfill = await backfillProvinces(db);
  logger.info(backfill, "province_backfill_done");

  const abort = new AbortController();
  const leadership = await acquireLeadership(config.databaseUrl, {
    signal: abort.signal,
    onWait: () => logger.info("standby: another worker is ingesting"),
  });
  if (!leadership) return;
  logger.info("ingest_leader");

  const redis = createRedis(config.redisUrl);
  redis.on("error", (error) => logger.warn({ err: String(error) }, "redis_error"));
  const poller = createFeedPoller({
    db,
    logger,
    baseUrl: config.bmkgBaseUrl,
    publish: async (payload) => void (await redis.publish(EVENT_CHANNEL, JSON.stringify(payload))),
    notify: async (event) => void (await notifySubscriptions(db, event, logger)),
  });
  const intervalsMs = Object.fromEntries(
    Object.entries(config.pollIntervalsSeconds).map(([feed, seconds]) => [feed, seconds * 1000]),
  ) as Record<FeedName, number>;
  const scheduler: FeedScheduler = new FeedScheduler({
    intervalsMs,
    poll: poller.poll,
    onAttempt: async () => {
      const heartbeat = buildHeartbeat(scheduler.snapshot(), poller.totals, startedAt, Date.now());
      await writeHeartbeat(redis, heartbeat).catch((error: unknown) =>
        logger.warn({ err: String(error) }, "heartbeat_failed"),
      );
    },
  });
  if (process.argv.includes("--once")) {
    for (const feed of Object.keys(intervalsMs) as FeedName[]) await poller.poll(feed);
    await leadership.release();
    await redis.quit().catch(() => undefined);
    await sql.end({ timeout: 5 });
    return;
  }
  const retention = createRetentionJob(db, {
    retentionDays: config.retentionDays,
    eventLogRetentionHours: config.eventLogRetentionHours,
    logger,
  });

  scheduler.start();
  await retention();
  const retentionTimer = setInterval(() => void retention(), RETENTION_INTERVAL_MS);
  const stopBot = startTelegramBot(db, logger);

  let stopping = false;
  const stop = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "shutdown");
    abort.abort();
    scheduler.stop();
    clearInterval(retentionTimer);
    stopBot();
    await leadership.release();
    await redis.quit().catch(() => undefined);
    await sql.end({ timeout: 5 }).catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
}

(command === "migrate" ? migrateOnly() : main()).catch((error: unknown) => {
  logger.fatal({ err: error }, command === "migrate" ? "migrate_failed" : "worker_crashed");
  process.exit(1);
});
