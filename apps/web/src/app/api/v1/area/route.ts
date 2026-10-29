import { apiError, clientIp, rateLimitResponse, type RateLimitRule } from "@indoquake/api";
// Server-only route: the bare regions entry carries the lookup geometry. Client code imports "@indoquake/regions/meta".
import { describeLocation } from "@indoquake/regions";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Per IP: the home asks once per stored or live location, so 60 a minute leaves room for manual changes. */
const AREA_RATE_LIMIT: RateLimitRule = { name: "area", limit: 60, windowSeconds: 60 };

function coordinate(value: string | null, limit: number): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

async function limited(request: Request): Promise<Response | null> {
  try {
    return await rateLimitResponse(getRedis(), [{ rule: AREA_RATE_LIMIT, key: clientIp(request.headers) }]);
  } catch {
    return null; // no Redis configured: fail open, like hitRateLimit does when Redis is down
  }
}

export async function GET(request: Request) {
  const tooMany = await limited(request);
  if (tooMany) return tooMany;
  const params = new URL(request.url).searchParams;
  const latitude = coordinate(params.get("lat"), 90);
  if (latitude === null) return apiError(400, "Parameter tidak valid: lat");
  const longitude = coordinate(params.get("lon"), 180);
  if (longitude === null) return apiError(400, "Parameter tidak valid: lon");
  const data = describeLocation(latitude, longitude);
  if (!data) return apiError(400, "Parameter tidak valid: lat");
  return Response.json({ data }, { headers: { "cache-control": "public, max-age=86400" } });
}
