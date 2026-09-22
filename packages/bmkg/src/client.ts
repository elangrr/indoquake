import { BMKG_FEED_URLS } from "@indoquake/shared";
import type { BmkgFeedName } from "./types";

export interface FetchBmkgFeedOptions {
  timeoutMs?: number;
}

export async function fetchBmkgFeed(
  feed: BmkgFeedName,
  options: FetchBmkgFeedOptions = {},
): Promise<unknown> {
  const response = await fetch(BMKG_FEED_URLS[feed], {
    headers: {
      "user-agent": "Indoquake/0.1 (monitoring gempa Jawa; sumber data BMKG)",
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });
  if (!response.ok) {
    throw new Error(`BMKG ${feed}: HTTP ${response.status}`);
  }
  return response.json();
}
