import { and, asc, count, desc, eq, gte, ilike, isNotNull, lte, max, type SQL } from "drizzle-orm";
import {
  earthquakeFeeds,
  earthquakes,
  earthquakeUpdates,
  toEarthquakeEvent,
  type Database,
} from "@indoquake/database";
import {
  countByDay,
  countByHour,
  countByMonth,
  countByProvince,
  depthDistribution,
  magnitudeDistribution,
  summarize,
} from "@indoquake/earthquake";
import { PROVINCE_OPTIONS } from "@indoquake/regions";
import type { EarthquakeDetail, EarthquakeEvent, EarthquakeListResponse } from "@indoquake/shared";
import { escapeLike, LIST_LIMIT_DEFAULT, pageMeta, type ListQuery } from "./params";

export const EVENT_KEY_PATTERN = /^[0-9a-f]{16}$/;

function filtersFor(query: ListQuery): SQL | undefined {
  const filters: SQL[] = [];
  if (query.minMagnitude !== undefined) filters.push(gte(earthquakes.magnitude, query.minMagnitude));
  if (query.maxMagnitude !== undefined) filters.push(lte(earthquakes.magnitude, query.maxMagnitude));
  if (query.minDepthKm !== undefined) filters.push(gte(earthquakes.depthKm, query.minDepthKm));
  if (query.maxDepthKm !== undefined) filters.push(lte(earthquakes.depthKm, query.maxDepthKm));
  if (query.fromUtc) filters.push(gte(earthquakes.eventTimeUtc, new Date(query.fromUtc)));
  if (query.toUtc) filters.push(lte(earthquakes.eventTimeUtc, new Date(query.toUtc)));
  if (query.feltOnly) filters.push(isNotNull(earthquakes.feltText));
  if (query.tsunamiOnly) filters.push(eq(earthquakes.tsunamiPotential, true));
  if (query.provinceSlug) filters.push(eq(earthquakes.provinceSlug, query.provinceSlug));
  if (query.q) filters.push(ilike(earthquakes.regionName, `%${escapeLike(query.q)}%`));
  return filters.length > 0 ? and(...filters) : undefined;
}

/** One page of matching quakes, filtered and paged in SQL (no row cap, D10, D11). */
export async function listEarthquakes(
  db: Database,
  query: ListQuery,
): Promise<{ data: EarthquakeEvent[]; total: number }> {
  const where = filtersFor(query);
  const limit = query.limit ?? LIST_LIMIT_DEFAULT;
  const page = query.page ?? 1;
  const direction = query.order === "asc" ? asc : desc;
  const rows = await db
    .select()
    .from(earthquakes)
    .where(where)
    .orderBy(direction(earthquakes.eventTimeUtc), direction(earthquakes.id))
    .limit(limit)
    .offset((page - 1) * limit);
  const [counted] = await db.select({ total: count() }).from(earthquakes).where(where);
  return { data: rows.map(toEarthquakeEvent), total: counted?.total ?? 0 };
}

export async function listEarthquakesResponse(
  db: Database,
  query: ListQuery & { limit: number; page: number },
): Promise<EarthquakeListResponse> {
  const { data, total } = await listEarthquakes(db, query);
  return { data, meta: pageMeta(total, query.page, query.limit, data.length) };
}

/** Detail with feeds and revisions (newest first); null for a malformed or unknown key. */
export async function getEarthquakeDetail(db: Database, eventKey: string): Promise<EarthquakeDetail | null> {
  if (!EVENT_KEY_PATTERN.test(eventKey)) return null;
  const [row] = await db.select().from(earthquakes).where(eq(earthquakes.eventKey, eventKey)).limit(1);
  if (!row) return null;
  const feedRows = await db
    .select({ feed: earthquakeFeeds.feed })
    .from(earthquakeFeeds)
    .where(eq(earthquakeFeeds.earthquakeId, row.id))
    .orderBy(asc(earthquakeFeeds.firstSeenAt));
  const revisionRows = await db
    .select()
    .from(earthquakeUpdates)
    .where(eq(earthquakeUpdates.earthquakeId, row.id))
    .orderBy(desc(earthquakeUpdates.observedAt), desc(earthquakeUpdates.id));
  return {
    ...toEarthquakeEvent(row),
    feeds: feedRows.map((feedRow) => feedRow.feed),
    revisions: revisionRows.map((revision) => ({
      field: revision.field,
      oldValue: revision.oldValue,
      newValue: revision.newValue,
      observedAt: revision.observedAt.toISOString(),
    })),
  };
}

export async function earthquakeTotals(db: Database): Promise<{ count: number; latestEventAt: string | null }> {
  const [row] = await db
    .select({ count: count(), latest: max(earthquakes.eventTimeUtc) })
    .from(earthquakes);
  const latest = row?.latest ?? null;
  return { count: row?.count ?? 0, latestEventAt: latest ? new Date(latest).toISOString() : null };
}

export interface StatisticsQuery {
  period: string;
  fromUtc: string | null;
  provinceSlug?: string;
  nowMs?: number;
}

/**
 * Statistics over every matching row (column-limited scan, no row cap, D11). byMonth covers the
 * last 12 WIB months whatever the period.
 */
export async function getStatistics(db: Database, query: StatisticsQuery) {
  const nowMs = query.nowMs ?? Date.now();
  const columns = {
    eventTimeUtc: earthquakes.eventTimeUtc,
    magnitude: earthquakes.magnitude,
    depthKm: earthquakes.depthKm,
    feltText: earthquakes.feltText,
    tsunamiPotential: earthquakes.tsunamiPotential,
    provinceSlug: earthquakes.provinceSlug,
  };
  const province = query.provinceSlug ? eq(earthquakes.provinceSlug, query.provinceSlug) : undefined;
  const rows = await db
    .select(columns)
    .from(earthquakes)
    .where(and(query.fromUtc ? gte(earthquakes.eventTimeUtc, new Date(query.fromUtc)) : undefined, province));
  const events = rows.map((row) => ({ ...row, eventTimeUtc: row.eventTimeUtc.toISOString() }));
  const yearAgo = new Date(nowMs - 400 * 86_400_000);
  const monthRows = await db
    .select({ eventTimeUtc: earthquakes.eventTimeUtc })
    .from(earthquakes)
    .where(and(gte(earthquakes.eventTimeUtc, yearAgo), province));
  const nowIso = new Date(nowMs).toISOString();
  return {
    data: {
      period: query.period,
      fromUtc: query.fromUtc,
      summary: summarize(events),
      magnitudeDistribution: magnitudeDistribution(events),
      depthDistribution: depthDistribution(events),
      byDay: countByDay(events, 30, nowIso),
      byHour: countByHour(events),
      byProvince: countByProvince(events, PROVINCE_OPTIONS),
      byMonth: countByMonth(
        monthRows.map((row) => ({ eventTimeUtc: row.eventTimeUtc.toISOString() })),
        12,
        nowIso,
      ),
    },
    meta: { generatedAt: nowIso },
  };
}
