import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { earthquakes } from "@indoquake/database";
import { getDb } from "@/lib/db";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const HEARTBEAT_KEY = "indoquake:worker:heartbeat";

export async function GET() {
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  let earthquakeCount: number | null = null;
  let latestEventAt: string | null = null;
  let dbError: string | null = null;

  try {
    const startedAt = Date.now();
    const [row] = await getDb()
      .select({
        count: sql<number>`count(*)::int`,
        latest: sql<string | null>`max(${earthquakes.eventTimeUtc})::text`,
      })
      .from(earthquakes);
    dbLatencyMs = Date.now() - startedAt;
    earthquakeCount = row?.count ?? 0;
    latestEventAt = row?.latest ?? null;
    dbOk = true;
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  let redisOk = false;
  let worker: unknown = null;
  let redisError: string | null = null;

  try {
    const raw = await getRedis().get(HEARTBEAT_KEY);
    worker = raw ? JSON.parse(raw) : null;
    redisOk = true;
  } catch (error) {
    redisError = error instanceof Error ? error.message : String(error);
  }

  const healthy = dbOk && redisOk;
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      time: new Date().toISOString(),
      checks: {
        database: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
        redis: { ok: redisOk, error: redisError },
      },
      earthquakes: { count: earthquakeCount, latestEventAt },
      worker,
    },
    { status: healthy ? 200 : 503 },
  );
}
