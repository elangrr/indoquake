import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

export interface WorkerConfig {
  databaseUrl: string;
  redisUrl: string;
  pollIntervalSeconds: number;
  logLevel: string;
  retentionDays: number;
}

export function loadConfig(): WorkerConfig {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL belum diisi di .env");
  if (!redisUrl) throw new Error("REDIS_URL belum diisi di .env");
  const pollIntervalSeconds = Number(
    process.env.BMKG_POLL_INTERVAL_SECONDS ?? 30,
  );
  const retentionDays = Number(process.env.RETENTION_DAYS ?? 3);
  return {
    databaseUrl,
    redisUrl,
    pollIntervalSeconds:
      Number.isFinite(pollIntervalSeconds) && pollIntervalSeconds > 0
        ? pollIntervalSeconds
        : 30,
    logLevel: process.env.LOG_LEVEL ?? "info",
    retentionDays:
      Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 3,
  };
}
