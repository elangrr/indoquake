import type { FeedName } from "@indoquake/shared";
import { POLL_INTERVAL_SECONDS } from "@indoquake/shared";
import { DEFAULT_BMKG_BASE_URL } from "@indoquake/bmkg";

export const MIN_POLL_SECONDS = 5;
export const DEFAULT_EVENT_LOG_RETENTION_HOURS = 72;

export interface WorkerConfig {
  databaseUrl: string;
  redisUrl: string;
  bmkgBaseUrl: string;
  pollIntervalsSeconds: Record<FeedName, number>;
  logLevel: string;
  /** 0 = keep every quake forever (default). */
  retentionDays: number;
  eventLogRetentionHours: number;
  /** false only for REGION_BACKFILL=off (stop switch, D24). */
  regionBackfill: boolean;
}

type Env = Record<string, string | undefined>;

function number(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pollSeconds(env: Env, name: string, fallback: number): number {
  const legacy = number(env.BMKG_POLL_INTERVAL_SECONDS);
  const value = legacy ?? number(env[name]) ?? fallback;
  return Math.max(MIN_POLL_SECONDS, value);
}

export function loadConfig(env: Env = process.env): WorkerConfig {
  const databaseUrl = env.DATABASE_URL;
  const redisUrl = env.REDIS_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL belum diisi");
  if (!redisUrl) throw new Error("REDIS_URL belum diisi");
  const retentionDays = number(env.RETENTION_DAYS) ?? 0;
  const eventLogHours = number(env.EVENT_LOG_RETENTION_HOURS) ?? DEFAULT_EVENT_LOG_RETENTION_HOURS;
  return {
    databaseUrl,
    redisUrl,
    bmkgBaseUrl: env.BMKG_BASE_URL?.trim() || DEFAULT_BMKG_BASE_URL,
    pollIntervalsSeconds: {
      autogempa: pollSeconds(env, "BMKG_POLL_AUTOGEMPA_SECONDS", POLL_INTERVAL_SECONDS.autogempa),
      gempaterkini: pollSeconds(env, "BMKG_POLL_GEMPATERKINI_SECONDS", POLL_INTERVAL_SECONDS.gempaterkini),
      gempadirasakan: pollSeconds(env, "BMKG_POLL_GEMPADIRASAKAN_SECONDS", POLL_INTERVAL_SECONDS.gempadirasakan),
    },
    logLevel: env.LOG_LEVEL ?? "info",
    retentionDays: retentionDays > 0 ? retentionDays : 0,
    eventLogRetentionHours: eventLogHours > 0 ? eventLogHours : DEFAULT_EVENT_LOG_RETENTION_HOURS,
    regionBackfill: env.REGION_BACKFILL?.trim().toLowerCase() !== "off",
  };
}
