import {
  buildHealth,
  buildStatus,
  earthquakeTotals,
  getEarthquakeDetail as getDetail,
  listEarthquakes as listPage,
  type HealthSources,
  type ListQuery,
} from "@indoquake/api";
import { HEARTBEAT_KEY, type EarthquakeDetail, type EarthquakeEvent, type WorkerHeartbeat } from "@indoquake/shared";
import { getDb } from "./db";
import { getRedis } from "./redis";

/** Filters for listEarthquakes; page and q were added in R133 (options are only ever added). */
export type ListEarthquakesOptions = ListQuery;

/** Matching quakes, filtered (including province and q) and paged in SQL. */
export async function listEarthquakes(options: ListEarthquakesOptions = {}): Promise<EarthquakeEvent[]> {
  const { data } = await listPage(getDb(), { ...options, limit: options.limit ?? 200 });
  return data;
}

export async function getEarthquakeDetail(eventKey: string): Promise<EarthquakeDetail | null> {
  return getDetail(getDb(), eventKey);
}

export function healthSources(): HealthSources {
  return {
    totals: () => earthquakeTotals(getDb()),
    heartbeat: async () => {
      const raw = await getRedis().get(HEARTBEAT_KEY);
      return raw ? (JSON.parse(raw) as WorkerHeartbeat) : null;
    },
  };
}

export const getHealth = () => buildHealth(healthSources());
export const getStatus = () => buildStatus(healthSources());
