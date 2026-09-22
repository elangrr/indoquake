import { NextResponse } from "next/server";
import { getEarthquakeDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventKey: string }> },
) {
  const { eventKey } = await params;
  const data = await getEarthquakeDetail(eventKey);
  if (!data) {
    return NextResponse.json(
      { error: "Gempa tidak ditemukan" },
      { status: 404 },
    );
  }
  return NextResponse.json({ data });
}
