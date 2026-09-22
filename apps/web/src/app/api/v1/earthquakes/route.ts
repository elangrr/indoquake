import { NextResponse, type NextRequest } from "next/server";
import { listEarthquakes } from "@/lib/queries";

export const dynamic = "force-dynamic";

function optionalNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requestedLimit = optionalNumber(params.get("limit")) ?? 100;
  const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 500);

  const data = await listEarthquakes({
    limit,
    minMagnitude: optionalNumber(params.get("minMagnitude")),
    feltOnly: params.get("felt") === "true",
    tsunamiOnly: params.get("tsunami") === "true",
  });

  return NextResponse.json({ data, meta: { count: data.length, limit } });
}
