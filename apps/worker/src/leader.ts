import postgres from "postgres";

/** Session advisory lock held by the one worker that ingests (A-20). */
export const INGEST_LEADER_KEY = 7133003;

export interface Leadership {
  release: () => Promise<void>;
}

/**
 * Waits until this process holds the ingest leadership lock on its own connection. A standby worker
 * keeps retrying; when the leader dies its connection closes and the lock frees.
 */
export async function acquireLeadership(
  databaseUrl: string,
  options: { retryMs?: number; onWait?: () => void; signal?: AbortSignal } = {},
): Promise<Leadership | null> {
  const client = postgres(databaseUrl, { max: 1, idle_timeout: 0, onnotice: () => undefined });
  for (;;) {
    if (options.signal?.aborted) {
      await client.end({ timeout: 5 });
      return null;
    }
    const [row] = await client<{ locked: boolean }[]>`select pg_try_advisory_lock(${INGEST_LEADER_KEY}) as locked`;
    if (row?.locked) {
      return {
        release: async () => {
          await client`select pg_advisory_unlock(${INGEST_LEADER_KEY})`.catch(() => undefined);
          await client.end({ timeout: 5 });
        },
      };
    }
    options.onWait?.();
    await new Promise((resolve) => setTimeout(resolve, options.retryMs ?? 15_000));
  }
}
