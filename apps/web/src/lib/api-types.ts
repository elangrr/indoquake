import type { PeriodId } from "./period";

/** GET /api/v1/statistics (contract section 5). byMonth is new with lane A and may be absent on older servers. */
export interface StatisticsResponse {
  data: {
    period: PeriodId;
    fromUtc: string | null;
    summary: {
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
    };
    magnitudeDistribution: { label: string; count: number }[];
    depthDistribution: { label: string; count: number }[];
    byDay: { date: string; count: number }[];
    byHour: number[];
    byProvince: { slug: string; name: string; count: number }[];
    byMonth?: { month: string; count: number }[];
  };
  meta?: { generatedAt: string };
}
