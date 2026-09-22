export interface StatEvent {
  eventTimeUtc: string;
  magnitude: number;
  depthKm: number;
  feltText: string | null;
  tsunamiPotential: boolean | null;
  provinceSlug?: string | null;
}

export interface StatisticsSummary {
  total: number;
  countM3: number;
  countM4: number;
  countM5: number;
  countFelt: number;
  countTsunami: number;
  strongestMagnitude: number | null;
  deepestKm: number | null;
  averageDepthKm: number | null;
  averageMagnitude: number | null;
}

export function summarize(events: StatEvent[]): StatisticsSummary {
  if (events.length === 0) {
    return {
      total: 0,
      countM3: 0,
      countM4: 0,
      countM5: 0,
      countFelt: 0,
      countTsunami: 0,
      strongestMagnitude: null,
      deepestKm: null,
      averageDepthKm: null,
      averageMagnitude: null,
    };
  }

  let countM3 = 0;
  let countM4 = 0;
  let countM5 = 0;
  let countFelt = 0;
  let countTsunami = 0;
  let strongest = -Infinity;
  let deepest = -Infinity;
  let magnitudeSum = 0;
  let depthSum = 0;

  for (const event of events) {
    if (event.magnitude >= 3) countM3 += 1;
    if (event.magnitude >= 4) countM4 += 1;
    if (event.magnitude >= 5) countM5 += 1;
    if (event.feltText) countFelt += 1;
    if (event.tsunamiPotential === true) countTsunami += 1;
    if (event.magnitude > strongest) strongest = event.magnitude;
    if (event.depthKm > deepest) deepest = event.depthKm;
    magnitudeSum += event.magnitude;
    depthSum += event.depthKm;
  }

  return {
    total: events.length,
    countM3,
    countM4,
    countM5,
    countFelt,
    countTsunami,
    strongestMagnitude: strongest,
    deepestKm: deepest,
    averageDepthKm: Math.round((depthSum / events.length) * 10) / 10,
    averageMagnitude: Math.round((magnitudeSum / events.length) * 100) / 100,
  };
}

export interface NumericBucket {
  label: string;
  min: number;
  max: number | null;
}

export const MAGNITUDE_BUCKETS: readonly NumericBucket[] = [
  { label: "< 2", min: -Infinity, max: 2 },
  { label: "2 – 3", min: 2, max: 3 },
  { label: "3 – 4", min: 3, max: 4 },
  { label: "4 – 5", min: 4, max: 5 },
  { label: "5 – 6", min: 5, max: 6 },
  { label: "≥ 6", min: 6, max: null },
];

export const DEPTH_BUCKETS: readonly NumericBucket[] = [
  { label: "< 10", min: 0, max: 10 },
  { label: "10 – 30", min: 10, max: 30 },
  { label: "30 – 70", min: 30, max: 70 },
  { label: "70 – 150", min: 70, max: 150 },
  { label: "150 – 300", min: 150, max: 300 },
  { label: "≥ 300", min: 300, max: null },
];

function inBucket(value: number, bucket: NumericBucket): boolean {
  if (value < bucket.min) return false;
  if (bucket.max !== null && value >= bucket.max) return false;
  return true;
}

export function bucketCounts(
  values: number[],
  buckets: readonly NumericBucket[] = MAGNITUDE_BUCKETS,
): { label: string; count: number }[] {
  return buckets.map((bucket) => ({
    label: bucket.label,
    count: values.filter((value) => inBucket(value, bucket)).length,
  }));
}

export function magnitudeDistribution(
  events: StatEvent[],
): { label: string; count: number }[] {
  return bucketCounts(
    events.map((event) => event.magnitude),
    MAGNITUDE_BUCKETS,
  );
}

export function depthDistribution(
  events: StatEvent[],
): { label: string; count: number }[] {
  return bucketCounts(
    events.map((event) => event.depthKm),
    DEPTH_BUCKETS,
  );
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function wibDate(iso: string): Date {
  return new Date(new Date(iso).getTime() + WIB_OFFSET_MS);
}

export function wibDateKey(iso: string): string {
  return wibDate(iso).toISOString().slice(0, 10);
}

export function countByDay(
  events: StatEvent[],
  days = 30,
  referenceIso?: string,
): { date: string; count: number }[] {
  const reference = referenceIso
    ? new Date(referenceIso)
    : new Date(
        events.length > 0
          ? events
              .map((event) => new Date(event.eventTimeUtc).getTime())
              .reduce((a, b) => Math.max(a, b), 0)
          : Date.now(),
      );

  const buckets: { date: string; count: number }[] = [];
  const index = new Map<string, number>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(reference.getTime() + WIB_OFFSET_MS - offset * 86400000);
    const key = day.toISOString().slice(0, 10);
    index.set(key, buckets.length);
    buckets.push({ date: key, count: 0 });
  }

  for (const event of events) {
    const key = wibDateKey(event.eventTimeUtc);
    const position = index.get(key);
    if (position !== undefined) {
      buckets[position].count += 1;
    }
  }

  return buckets;
}

export function countByHour(events: StatEvent[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const event of events) {
    const hour = wibDate(event.eventTimeUtc).getUTCHours();
    hours[hour] += 1;
  }
  return hours;
}

export function countByProvince(
  events: StatEvent[],
  provinces: readonly { slug: string; name: string }[],
): { slug: string; name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (!event.provinceSlug) continue;
    counts.set(event.provinceSlug, (counts.get(event.provinceSlug) ?? 0) + 1);
  }
  return provinces
    .map((province) => ({
      slug: province.slug,
      name: province.name,
      count: counts.get(province.slug) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}
