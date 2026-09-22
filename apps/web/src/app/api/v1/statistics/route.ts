import { NextResponse, type NextRequest } from "next/server";
import {
  countByDay,
  countByHour,
  countByProvince,
  depthDistribution,
  magnitudeDistribution,
  summarize,
} from "@indoquake/earthquake";
import { listEarthquakes } from "@/lib/queries";
import { PROVINCE_OPTIONS } from "@indoquake/regions";
import { parsePeriod } from "@/lib/period";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const period = parsePeriod(params.get("period") ?? undefined);
  const provinceSlug = params.get("province") ?? undefined;

  const events = await listEarthquakes({
    limit: 5000,
    fromUtc: period.fromUtc ?? undefined,
    provinceSlug: provinceSlug || undefined,
  });

  return NextResponse.json({
    data: {
      period: period.id,
      fromUtc: period.fromUtc,
      summary: summarize(events),
      magnitudeDistribution: magnitudeDistribution(events),
      depthDistribution: depthDistribution(events),
      byDay: countByDay(events, 30),
      byHour: countByHour(events),
      byProvince: countByProvince(events, PROVINCE_OPTIONS),
    },
  });
}
