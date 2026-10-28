import { apiError, json } from "@indoquake/api";
import { getEarthquakeDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const { eventKey } = await params;
  try {
    const data = await getEarthquakeDetail(eventKey);
    if (!data) return apiError(404, "Gempa tidak ditemukan");
    return json({ data });
  } catch {
    return apiError(503, "Data belum bisa dimuat");
  }
}
