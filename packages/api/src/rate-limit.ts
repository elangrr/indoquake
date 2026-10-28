import type Redis from "ioredis";

export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  subscribe: { name: "subscribe", limit: 10, windowSeconds: 3_600 },
  testPerIp: { name: "test-ip", limit: 5, windowSeconds: 60 },
  testGlobal: { name: "test-all", limit: 200, windowSeconds: 86_400 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Fixed-window counter in Redis keyed by rule and client key. Fails open when Redis is unreachable
 * (the health endpoint reports Redis down separately).
 */
export async function hitRateLimit(
  redis: Pick<Redis, "incr" | "expire">,
  rule: RateLimitRule,
  key: string,
  nowMs: number = Date.now(),
): Promise<RateLimitResult> {
  const windowIndex = Math.floor(nowMs / 1000 / rule.windowSeconds);
  const redisKey = `indoquake:rl:${rule.name}:${key}:${windowIndex}`;
  try {
    const hits = await redis.incr(redisKey);
    if (hits === 1) await redis.expire(redisKey, rule.windowSeconds);
    if (hits <= rule.limit) return { ok: true };
  } catch {
    return { ok: true };
  }
  const windowEnd = (windowIndex + 1) * rule.windowSeconds;
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(windowEnd - nowMs / 1000)) };
}

/**
 * Checks every rule against its key in order; returns the 429 response for the first rule over its
 * limit, or null when the request may proceed (A-18).
 */
export async function rateLimitResponse(
  redis: Pick<Redis, "incr" | "expire">,
  checks: { rule: RateLimitRule; key: string }[],
  nowMs: number = Date.now(),
): Promise<Response | null> {
  for (const check of checks) {
    const result = await hitRateLimit(redis, check.rule, check.key, nowMs);
    if (!result.ok) {
      return Response.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti.", retryAfterSeconds: result.retryAfterSeconds },
        { status: 429, headers: { "retry-after": String(result.retryAfterSeconds), "cache-control": "no-store" } },
      );
    }
  }
  return null;
}
