import type { ApiError } from "@indoquake/shared";

const NO_STORE = { "cache-control": "no-store" };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/** Error body is always a short Indonesian message, never internal error text. */
export function apiError(status: number, error: string, retryAfterSeconds?: number): Response {
  const body: ApiError = retryAfterSeconds === undefined ? { error } : { error, retryAfterSeconds };
  const headers: Record<string, string> =
    retryAfterSeconds === undefined ? {} : { "retry-after": String(retryAfterSeconds) };
  return json(body, status, headers);
}

/**
 * Client IP for rate limits and stream caps: the X-Real-IP header only. nginx overwrites it with
 * $remote_addr and the web container is reachable only through nginx; X-Forwarded-For is ignored
 * because the caller controls it (D19).
 */
export function clientIp(headers: Headers): string {
  const value = headers.get("x-real-ip")?.trim();
  return value ? value : "unknown";
}
