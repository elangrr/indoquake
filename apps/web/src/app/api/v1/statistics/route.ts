import { apiError, getStatistics, json, parseAreaFilters } from "@indoquake/api";
import { getDb } from "@/lib/db";
import { parsePeriod } from "@/lib/period";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = parsePeriod(params.get("period") ?? undefined);
  const parsed = parseAreaFilters(params);
  if (!parsed.ok) return apiError(400, parsed.error);
  const { provinceSlug, area } = parsed.filters;
  try {
    return json(await getStatistics(getDb(), { period: period.id, fromUtc: period.fromUtc, provinceSlug, area }));
  } catch {
    return apiError(503, "Data belum bisa dimuat");
  }
}
