import type { BmkgFeedName } from "./types";

export const DEFAULT_BMKG_BASE_URL = "https://data.bmkg.go.id/DataMKG/TEWS";
export const FETCH_TIMEOUT_MS = 8_000;
export const RETRY_AFTER_CAP_SECONDS = 300;
const USER_AGENT = "Indoquake/0.2 (monitoring gempa Indonesia; sumber data BMKG)";

export interface FetchBmkgFeedOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** Validators from the previous 200 response; sent as If-None-Match / If-Modified-Since. */
  etag?: string | null;
  lastModified?: string | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export type FetchBmkgFeedResult =
  | { status: "ok"; payload: unknown; etag: string | null; lastModified: string | null }
  | { status: "not-modified" };

export class BmkgHttpError extends Error {
  constructor(
    readonly feed: BmkgFeedName,
    readonly status: number,
    readonly retryAfterSeconds: number | null,
  ) {
    super(`BMKG ${feed}: HTTP ${status}`);
    this.name = "BmkgHttpError";
  }
}

/** Retry-After as delta seconds or HTTP date, capped at 300 s; null when absent or unusable. */
export function parseRetryAfter(value: string | null | undefined, nowMs: number): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  let seconds: number;
  if (/^\d+$/.test(trimmed)) {
    seconds = Number(trimmed);
  } else {
    const at = Date.parse(trimmed);
    if (Number.isNaN(at)) return null;
    seconds = Math.max(0, Math.ceil((at - nowMs) / 1000));
  }
  return Math.min(seconds, RETRY_AFTER_CAP_SECONDS);
}

export function feedUrl(feed: BmkgFeedName, baseUrl = DEFAULT_BMKG_BASE_URL): string {
  return `${baseUrl.replace(/\/+$/, "")}/${feed}.json`;
}

/** One GET of a BMKG feed, no retries (the scheduler's next tick is the retry). */
export async function fetchBmkgFeed(
  feed: BmkgFeedName,
  options: FetchBmkgFeedOptions = {},
): Promise<FetchBmkgFeedResult> {
  const headers: Record<string, string> = { "user-agent": USER_AGENT, accept: "application/json" };
  if (options.etag) headers["if-none-match"] = options.etag;
  if (options.lastModified) headers["if-modified-since"] = options.lastModified;
  const response = await (options.fetchImpl ?? fetch)(feedUrl(feed, options.baseUrl), {
    headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS),
  });
  if (response.status === 304) {
    await response.body?.cancel();
    return { status: "not-modified" };
  }
  if (!response.ok) {
    await response.body?.cancel();
    const now = options.now?.() ?? Date.now();
    throw new BmkgHttpError(feed, response.status, parseRetryAfter(response.headers.get("retry-after"), now));
  }
  return {
    status: "ok",
    payload: await response.json(),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}
