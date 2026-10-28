import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Advisory lock key shared by the migrator and migration 0002 (pg_advisory_xact_lock). */
export const MIGRATION_LOCK_KEY = 7133001;

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Error codes that mean "the database is not reachable yet": refused or reset TCP, DNS not ready
 * (compose service name), connect timeout, and Postgres 57P03 (starting up / shutting down).
 * Any other error (SQL, auth, migration file) is not retried.
 */
const CONNECT_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "CONNECT_TIMEOUT",
  "57P03",
]);

export function connectErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && CONNECT_ERROR_CODES.has(code)) return code;
  // Node reports a refused connect to several addresses (::1 and 127.0.0.1) as an AggregateError.
  const inner = (error as { errors?: unknown }).errors;
  if (Array.isArray(inner)) {
    for (const item of inner) {
      const innerCode = connectErrorCode(item);
      if (innerCode) return innerCode;
    }
  }
  return null;
}

export interface ConnectRetryOptions {
  /** Total tries, including the first. Default 10. */
  attempts?: number;
  /** Delay before the second try; doubles each retry. Default 250 ms. */
  baseDelayMs?: number;
  /** Upper bound for one delay. Default 5000 ms. */
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (retry: { attempt: number; delayMs: number; code: string }) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const defaultOnRetry: NonNullable<ConnectRetryOptions["onRetry"]> = (retry) => {
  console.warn(JSON.stringify({ msg: "migrate_connect_retry", ...retry }));
};

/**
 * Runs `connect` until it succeeds, retrying only connect errors (see connectErrorCode) with a
 * capped exponential backoff. Gives up after `attempts` tries with the last error; any other
 * error fails at once.
 */
export async function withConnectRetry<T>(
  connect: () => Promise<T>,
  options: ConnectRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 10;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  const sleep = options.sleep ?? defaultSleep;
  const onRetry = options.onRetry ?? defaultOnRetry;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await connect();
    } catch (error) {
      const code = connectErrorCode(error);
      if (code === null || attempt >= attempts) throw error;
      const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      onRetry({ attempt, delayMs, code });
      await sleep(delayMs);
    }
  }
}

export interface RunMigrationsOptions {
  retry?: ConnectRetryOptions;
}

/**
 * Applies pending migrations once, even when several processes start together: one connection holds
 * a session advisory lock while drizzle's migrator applies every pending file in one transaction.
 * A second run (or a runner that waited for the lock) finds nothing pending and is a no-op.
 * The first connect is retried while the database is still starting (withConnectRetry).
 */
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string = MIGRATIONS_FOLDER,
  options: RunMigrationsOptions = {},
): Promise<void> {
  const client = await withConnectRetry(async () => {
    const candidate = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
    try {
      await candidate`select 1`;
      return candidate;
    } catch (error) {
      await candidate.end({ timeout: 1 }).catch(() => undefined);
      throw error;
    }
  }, options.retry);
  try {
    await client`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    try {
      await migrate(drizzle(client), { migrationsFolder });
    } finally {
      await client`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}
