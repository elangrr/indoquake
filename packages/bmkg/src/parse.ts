import { BMKG_SHAKEMAP_BASE_URL } from "@indoquake/shared";
import { eventKeyFor } from "./dedup";
import type {
  BmkgFeedName,
  BmkgGempaRaw,
  FeltReport,
  NormalizedEarthquake,
} from "./types";

export function parseCoordinates(
  coordinates: string | undefined,
): { latitude: number; longitude: number } | null {
  if (typeof coordinates !== "string") return null;
  const parts = coordinates
    .split(",")
    .map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 2) return null;
  const [latitude, longitude] = parts;
  if (latitude === undefined || longitude === undefined) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

export function parseDepthKm(kedalaman: string | undefined): number | null {
  if (typeof kedalaman !== "string") return null;
  const match = /(\d+(?:[.,]\d+)?)/.exec(kedalaman);
  if (!match?.[1]) return null;
  const depth = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(depth) && depth >= 0 ? depth : null;
}

export function parseMagnitude(magnitude: string | undefined): number | null {
  if (typeof magnitude !== "string") return null;
  const value = Number.parseFloat(magnitude.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function parseFeltReports(dirasakan: string | undefined): FeltReport[] {
  if (!dirasakan) return [];
  const reports: FeltReport[] = [];
  for (const raw of dirasakan.split(",")) {
    const match = /^((?:[IVX]+)(?:-(?:[IVX]+))?)\s+(.+)$/.exec(raw.trim());
    if (match?.[1] && match[2]) {
      reports.push({ mmi: match[1], place: match[2].trim() });
    }
  }
  return reports;
}

export function classifyTsunamiPotential(
  potensi: string | undefined,
): boolean | null {
  if (!potensi) return null;
  const normalized = potensi.toLowerCase();
  if (normalized.includes("tidak berpotensi tsunami")) return false;
  if (normalized.includes("berpotensi tsunami")) return true;
  return null;
}

export function normalizeGempa(
  raw: BmkgGempaRaw,
  feed: BmkgFeedName,
): NormalizedEarthquake | null {
  const coordinates = parseCoordinates(raw.Coordinates);
  const depthKm = parseDepthKm(raw.Kedalaman);
  const magnitude = parseMagnitude(raw.Magnitude);
  const eventTime = new Date(raw.DateTime);
  if (
    !coordinates ||
    depthKm === null ||
    magnitude === null ||
    Number.isNaN(eventTime.getTime())
  ) {
    return null;
  }
  const eventTimeUtc = eventTime.toISOString();
  return {
    eventKey: eventKeyFor({ eventTimeUtc, ...coordinates }),
    feed,
    eventTimeUtc,
    eventTimeWib: [raw.Tanggal, raw.Jam].filter(Boolean).join(" ").trim(),
    ...coordinates,
    depthKm,
    magnitude,
    regionName: raw.Wilayah ?? "",
    potentialText: raw.Potensi ?? null,
    tsunamiPotential: classifyTsunamiPotential(raw.Potensi),
    feltText: raw.Dirasakan ?? null,
    feltReports: parseFeltReports(raw.Dirasakan),
    shakemapUrl: raw.Shakemap
      ? `${BMKG_SHAKEMAP_BASE_URL}${raw.Shakemap}`
      : null,
    source: "BMKG",
  };
}

export function extractGempaList(payload: unknown): BmkgGempaRaw[] {
  const gempa = (payload as { Infogempa?: { gempa?: unknown } } | null)
    ?.Infogempa?.gempa;
  if (Array.isArray(gempa)) return gempa as BmkgGempaRaw[];
  if (gempa && typeof gempa === "object") return [gempa as BmkgGempaRaw];
  return [];
}

export function parseFeedPayload(
  payload: unknown,
  feed: BmkgFeedName,
): NormalizedEarthquake[] {
  return extractGempaList(payload)
    .map((gempa) => normalizeGempa(gempa, feed))
    .filter((gempa): gempa is NormalizedEarthquake => gempa !== null);
}
