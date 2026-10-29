import { readFileSync } from "node:fs";

// The 38-province table straight from the regions data (Playwright cannot import the package's JSON modules).
const PROVINCE_TABLE = (
  JSON.parse(readFileSync(new URL("../../../packages/regions/src/data/provinces-table.json", import.meta.url), "utf8")) as {
    provinces: { slug: string; name: string; zone: string }[];
  }
).provinces;

// Land counts (sum 114) and sea counts within 300 km (sum 31 = summary.countSea); 145 events in total.
const LAND: Record<string, number> = {
  "jawa-barat": 18, "jawa-timur": 14, "jawa-tengah": 8, banten: 5, "di-yogyakarta": 3, aceh: 9, "sumatera-utara": 7,
  "sumatera-barat": 6, bengkulu: 4, lampung: 3, "nusa-tenggara-timur": 8, "nusa-tenggara-barat": 5, bali: 2,
  "sulawesi-tengah": 7, "sulawesi-utara": 4, maluku: 5, "maluku-utara": 3, papua: 3,
};
const SEA: Record<string, number> = { "jawa-barat": 6, "jawa-timur": 7, maluku: 9, "sulawesi-tengah": 2, aceh: 3, "nusa-tenggara-timur": 4 };

/** Always the 38 provinces, zeros included, sorted by land count then table order (contract section 7). */
function byProvince() {
  return PROVINCE_TABLE.map((row) => ({ slug: row.slug, name: row.name, zone: row.zone, count: LAND[row.slug] ?? 0, seaCount: SEA[row.slug] ?? 0 }))
    .sort((a, b) => b.count - a.count);
}

/** /api/v1/statistics response in the contract shape, numbers from a plausible 30 day window. */
export function statistics(period = "30d") {
  const days = Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 8, 29 + index)).toISOString().slice(0, 10),
    count: [3, 5, 2, 7, 4, 6, 3, 9, 4, 2, 5, 6, 8, 3, 4, 5, 2, 6, 7, 3, 4, 11, 5, 3, 6, 4, 2, 5, 7, 4][index],
  }));
  return {
    data: {
      period,
      fromUtc: "2026-09-28T17:00:00.000Z",
      summary: {
        total: 145,
        countM3: 114,
        countM4: 50,
        countM5: 12,
        countFelt: 21,
        countTsunami: 0,
        strongestMagnitude: 6.1,
        deepestKm: 412,
        averageDepthKm: 38.4,
        averageMagnitude: 3.7,
        countSea: 31,
      },
      magnitudeDistribution: [
        { label: "< 2", min: null, max: 2, count: 4 },
        { label: "2 \u2013 3", min: 2, max: 3, count: 27 },
        { label: "3 \u2013 4", min: 3, max: 4, count: 64 },
        { label: "4 \u2013 5", min: 4, max: 5, count: 38 },
        { label: "5 \u2013 6", min: 5, max: 6, count: 11 },
        { label: "\u2265 6", min: 6, max: null, count: 1 },
      ],
      depthDistribution: [
        { label: "< 10", min: 0, max: 10, count: 22 },
        { label: "10 \u2013 30", min: 10, max: 30, count: 41 },
        { label: "30 \u2013 70", min: 30, max: 70, count: 39 },
        { label: "70 \u2013 150", min: 70, max: 150, count: 25 },
        { label: "150 \u2013 300", min: 150, max: 300, count: 14 },
        { label: "\u2265 300", min: 300, max: null, count: 4 },
      ],
      byDay: days,
      byHour: [4, 6, 5, 7, 6, 8, 5, 4, 6, 7, 5, 6, 8, 7, 5, 6, 4, 7, 6, 5, 8, 6, 5, 4],
      byProvince: byProvince(),
      byMonth: Array.from({ length: 12 }, (_, index) => ({
        month: `${index < 2 ? 2025 : 2026}-${String(((index + 10) % 12) + 1).padStart(2, "0")}`,
        count: [118, 131, 97, 142, 120, 109, 151, 133, 126, 140, 145, 98][index],
      })),
    },
    meta: { generatedAt: new Date().toISOString() },
  };
}
