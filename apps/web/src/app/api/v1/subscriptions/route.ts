import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { alertSubscriptions } from "@indoquake/database";
import { PROVINCE_OPTIONS } from "@indoquake/regions";
import { getDb } from "@/lib/db";
import { validateChannelTarget } from "@/lib/subscription-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SubscriptionBody {
  channel?: string;
  target?: string;
  minMagnitude?: number;
  maxDistanceKm?: number | null;
  provinceSlug?: string | null;
  tsunamiOnly?: boolean;
  feltOnly?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export async function POST(request: NextRequest) {
  let body: SubscriptionBody;
  try {
    body = (await request.json()) as SubscriptionBody;
  } catch {
    return NextResponse.json(
      { error: "Body JSON tidak valid" },
      { status: 400 },
    );
  }

  const validated = validateChannelTarget(body.channel, body.target);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { channel, target } = validated;

  const minMagnitude = Number(body.minMagnitude ?? 4.5);
  if (!Number.isFinite(minMagnitude) || minMagnitude < 0 || minMagnitude > 10) {
    return NextResponse.json(
      { error: "Ambang magnitudo harus antara 0 dan 10" },
      { status: 400 },
    );
  }

  const maxDistanceRaw = body.maxDistanceKm;
  const maxDistanceKm =
    maxDistanceRaw === null || maxDistanceRaw === undefined
      ? null
      : Number(maxDistanceRaw);
  if (
    maxDistanceKm !== null &&
    (!Number.isFinite(maxDistanceKm) || maxDistanceKm < 1 || maxDistanceKm > 2000)
  ) {
    return NextResponse.json(
      { error: "Radius harus antara 1 dan 2000 km" },
      { status: 400 },
    );
  }

  const provinceSlug = body.provinceSlug ?? null;
  if (
    provinceSlug &&
    !PROVINCE_OPTIONS.some((province) => province.slug === provinceSlug)
  ) {
    return NextResponse.json({ error: "Provinsi tidak dikenal" }, { status: 400 });
  }

  const latitude = body.latitude ?? null;
  const longitude = body.longitude ?? null;
  if ((latitude === null) !== (longitude === null)) {
    return NextResponse.json(
      { error: "latitude dan longitude harus diisi bersamaan" },
      { status: 400 },
    );
  }
  if (
    latitude !== null &&
    longitude !== null &&
    (!Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180)
  ) {
    return NextResponse.json({ error: "Koordinat tidak valid" }, { status: 400 });
  }

  try {
    const [row] = await getDb()
      .insert(alertSubscriptions)
      .values({
        channel,
        target,
        minMagnitude,
        maxDistanceKm,
        provinceSlug,
        tsunamiOnly: body.tsunamiOnly === true,
        feltOnly: body.feltOnly === true,
        locationLatitude: latitude,
        locationLongitude: longitude,
        active: true,
      })
      .onConflictDoUpdate({
        target: [alertSubscriptions.channel, alertSubscriptions.target],
        set: {
          minMagnitude,
          maxDistanceKm,
          provinceSlug,
          tsunamiOnly: body.tsunamiOnly === true,
          feltOnly: body.feltOnly === true,
          locationLatitude: latitude,
          locationLongitude: longitude,
          active: true,
        },
      })
      .returning();
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan langganan",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("target")?.trim() ?? "";
  if (!target) {
    return NextResponse.json(
      { error: "Parameter target wajib diisi" },
      { status: 400 },
    );
  }
  const rows = await getDb()
    .select()
    .from(alertSubscriptions)
    .where(
      and(
        eq(alertSubscriptions.target, target),
        eq(alertSubscriptions.active, true),
      ),
    );
  return NextResponse.json({ data: rows });
}

export async function DELETE(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("target")?.trim() ?? "";
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!target || !Number.isInteger(id)) {
    return NextResponse.json(
      { error: "Parameter id dan target wajib diisi" },
      { status: 400 },
    );
  }
  await getDb()
    .update(alertSubscriptions)
    .set({ active: false })
    .where(
      and(
        eq(alertSubscriptions.id, id),
        eq(alertSubscriptions.target, target),
      ),
    );
  return NextResponse.json({ ok: true });
}
