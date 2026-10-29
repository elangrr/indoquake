import { apiError, getStatistics, json } from "@indoquake/api";
import { provinceBySlug } from "@indoquake/regions/meta";
import { getDb } from "@/lib/db";
import { parsePeriod } from "@/lib/period";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = parsePeriod(params.get("period") ?? undefined);
  const province = params.get("province")?.trim() || undefined;
  if (province && !provinceBySlug(province)) return apiError(400, "Provinsi tidak dikenal");
  try {
    return json(
      await getStatistics(getDb(), { period: period.id, fromUtc: period.fromUtc, provinceSlug: province }),
    );
  } catch {
    return apiError(503, "Data belum bisa dimuat");
  }
}
