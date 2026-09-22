import { NextResponse, type NextRequest } from "next/server";
import { getEarthquakeDetail } from "@/lib/queries";
import {
  getCachedFeltLocations,
  resolvePendingPlaces,
} from "@/lib/felt-geocode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const eventKey = request.nextUrl.searchParams.get("eventKey")?.trim() ?? "";
  if (!eventKey) {
    return NextResponse.json(
      { error: "Parameter eventKey wajib diisi" },
      { status: 400 },
    );
  }

  const event = await getEarthquakeDetail(eventKey);
  if (!event) {
    return NextResponse.json(
      { error: "Gempa tidak ditemukan" },
      { status: 404 },
    );
  }

  const total = event.feltReports?.length ?? 0;
  const { resolved, pendingPlaces } = await getCachedFeltLocations(event);

  if (pendingPlaces.length > 0) {
    void resolvePendingPlaces(event, pendingPlaces);
  }

  return NextResponse.json({
    data: resolved,
    meta: { total, pending: pendingPlaces.length },
  });
}
