import pino from "pino";
import { createDb } from "@indoquake/database";
import {
  BMKG_ATTRIBUTION,
  EVENT_CHANNEL,
  type EarthquakeStreamPayload,
} from "@indoquake/shared";
import { loadConfig } from "./env";
import { createRedis, writeHeartbeat } from "./heartbeat";
import { runCycle, type EventChange } from "./ingest";
import { notifySubscriptions } from "./notify";
import { purgeOldEarthquakes } from "./retention";
import { startTelegramBot } from "./telegram-bot";

const config = loadConfig();
const logger = pino({ level: config.logLevel });
const { sql, db } = createDb(config.databaseUrl);
const redis = createRedis(config.redisUrl);

const runOnce = process.argv.includes("--once");

async function publishChange(change: EventChange): Promise<void> {
  const payload: EarthquakeStreamPayload = {
    type: change.type === "new" ? "earthquake:new" : "earthquake:updated",
    event: change.event,
  };
  await redis.publish(EVENT_CHANNEL, JSON.stringify(payload));

  if (change.type === "new") {
    try {
      await notifySubscriptions(db, change.event, logger);
    } catch (error) {
      logger.warn({ err: error }, "notify_failed");
    }
  }
}

async function runCycleWithHeartbeat(): Promise<void> {
  const summary = await runCycle(db, logger, publishChange);
  await purgeOldEarthquakes(db, config.retentionDays, logger);
  await writeHeartbeat(redis, summary);
}

async function shutdown(code: number): Promise<void> {
  logger.info("shutdown");
  await redis.quit().catch(() => undefined);
  await sql.end({ timeout: 5 }).catch(() => undefined);
  process.exit(code);
}

async function main(): Promise<void> {
  logger.info(
    {
      pollIntervalSeconds: config.pollIntervalSeconds,
      retentionDays: config.retentionDays,
    },
    "worker_started",
  );
  console.log(BMKG_ATTRIBUTION);

  if (runOnce) {
    await runCycleWithHeartbeat();
    await shutdown(0);
    return;
  }

  let stopped = false;
  const stopBot = startTelegramBot(db, logger);
  const stop = (signal: string): void => {
    if (stopped) return;
    stopped = true;
    stopBot();
    logger.info({ signal }, "signal_received");
    void shutdown(0);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  const intervalMs = config.pollIntervalSeconds * 1000;
  const loop = async (): Promise<void> => {
    if (stopped) return;
    try {
      await runCycleWithHeartbeat();
    } catch (error) {
      logger.error({ err: error }, "cycle_failed");
    }
    if (!stopped) setTimeout(() => void loop(), intervalMs);
  };
  await loop();
}

main().catch((error) => {
  logger.fatal({ err: error }, "worker_crashed");
  process.exitCode = 1;
});
