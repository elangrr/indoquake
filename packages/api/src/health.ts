import type { HealthResponse, StatusPayload, WorkerHeartbeat } from "@indoquake/shared";
import { computeFreshness } from "./freshness";

export interface HealthSources {
  totals: () => Promise<{ count: number; latestEventAt: string | null }>;
  heartbeat: () => Promise<WorkerHeartbeat | null>;
  now?: () => number;
}

/**
 * GET /api/v1/health: 200 while the database and Redis answer, even when BMKG data is stale
 * (that is reported in `data`); 503 only when the database or Redis fails (A-16).
 */
export async function buildHealth(sources: HealthSources): Promise<{ status: 200 | 503; body: HealthResponse }> {
  const now = sources.now ?? Date.now;
  const startedAt = now();
  const database: HealthResponse["checks"]["database"] = { ok: false, latencyMs: null, error: null };
  const redis: HealthResponse["checks"]["redis"] = { ok: false, error: null };
  let totals: { count: number | null; latestEventAt: string | null } = { count: null, latestEventAt: null };
  let worker: WorkerHeartbeat | null = null;

  try {
    totals = await sources.totals();
    database.ok = true;
    database.latencyMs = now() - startedAt;
  } catch {
    database.error = "Database tidak terhubung";
  }
  try {
    worker = await sources.heartbeat();
    redis.ok = true;
  } catch {
    redis.error = "Redis tidak terhubung";
  }
  const healthy = database.ok && redis.ok;
  return {
    status: healthy ? 200 : 503,
    body: {
      status: healthy ? "ok" : "degraded",
      time: new Date(now()).toISOString(),
      checks: { database, redis },
      earthquakes: totals,
      worker,
      data: computeFreshness({
        heartbeat: worker,
        eventCount: totals.count ?? 0,
        latestEventAt: totals.latestEventAt,
        nowMs: now(),
      }),
    },
  };
}

/** The `status` SSE frame: freshness plus the server time. */
export async function buildStatus(sources: HealthSources): Promise<StatusPayload> {
  const { body } = await buildHealth(sources);
  return { ...(body.data ?? { state: "unknown", lastSuccessAt: null, ageSeconds: null, latestEventAt: null }), at: body.time };
}
