import { apiError, json, listEarthquakesResponse, parseListParams } from "@indoquake/api";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsed = parseListParams(new URL(request.url).searchParams);
  if (!parsed.ok) return apiError(400, parsed.error);
  try {
    return json(await listEarthquakesResponse(getDb(), parsed.query));
  } catch {
    return apiError(503, "Data belum bisa dimuat");
  }
}
