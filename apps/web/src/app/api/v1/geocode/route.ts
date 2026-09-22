import { NextResponse, type NextRequest } from "next/server";
import type { GeocodeResult } from "@/lib/geocode";
import {
  getNominatimCache,
  searchNominatim,
  waitForNominatimSlot,
} from "@/lib/nominatim";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 6;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return NextResponse.json({
      data: [],
      meta: { query, note: "minimal 3 karakter" },
    });
  }

  const cache = getNominatimCache();
  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      data: cached.data,
      meta: { query, cached: true },
    });
  }

  try {
    await waitForNominatimSlot();
    const data: GeocodeResult[] = await searchNominatim({
      query,
      limit: MAX_RESULTS,
    });
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data });
    return NextResponse.json({ data, meta: { query, cached: false } });
  } catch (error) {
    return NextResponse.json(
      {
        data: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
