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
      /** R137: sea events (any distance); absent on servers before R137. */
      countSea?: number;
    };
    magnitudeDistribution: { label: string; count: number }[];
    depthDistribution: { label: string; count: number }[];
    byDay: { date: string; count: number }[];
    byHour: number[];
    /** R137: always the 38 provinces; count = land events, seaCount = sea events within 300 km. */
    byProvince: { slug: string; name: string; zone?: string; count: number; seaCount?: number }[];
    byMonth?: { month: string; count: number }[];
  };
  meta?: { generatedAt: string };
}
