import { BMKG_SHAKEMAP_BASE_URL } from "@indoquake/shared";
import { eventKeyFor } from "./dedup";
import type {
  BmkgFeedName,
  BmkgGempaRaw,
  FeltReport,
  NormalizedEarthquake,
} from "./types";

export const MAGNITUDE_RANGE = { min: -2, max: 10 } as const;
export const DEPTH_RANGE_KM = { min: 0, max: 1000 } as const;
/** Tanggal/Jam (WIB) may differ from DateTime by this much before a warning is raised. */
export const TIME_MISMATCH_TOLERANCE_MS = 2_000;
const WIB_OFFSET_MS = 7 * 3_600_000;

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

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
  if (!inRange(latitude, -90, 90) || !inRange(longitude, -180, 180)) return null;
  return { latitude, longitude };
}

function parseHemisphereValue(
  text: string | undefined,
  positive: string,
  negative: string,
  limit: number,
): number | null {
  if (typeof text !== "string") return null;
  const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*([A-Za-z]{2})\s*$/.exec(text);
  if (!match?.[1] || !match[2]) return null;
  const magnitude = Number.parseFloat(match[1].replace(",", "."));
  const hemisphere = match[2].toUpperCase();
  if (!Number.isFinite(magnitude) || magnitude < 0) return null;
  let value: number;
  if (hemisphere === positive) value = magnitude;
  else if (hemisphere === negative) value = -magnitude;
  else return null;
  return inRange(value, -limit, limit) ? value : null;
}

/** BMKG `Lintang`: "7.22 LS" is -7.22 (south), "2.52 LU" is 2.52 (north). */
export function parseLatitude(lintang: string | undefined): number | null {
  return parseHemisphereValue(lintang, "LU", "LS", 90);
}

/** BMKG `Bujur`: "107.62 BT" is 107.62 (east), "10.5 BB" is -10.5 (west). */
export function parseLongitude(bujur: string | undefined): number | null {
  return parseHemisphereValue(bujur, "BT", "BB", 180);
}

export function parseDepthKm(kedalaman: string | undefined): number | null {
  if (typeof kedalaman !== "string") return null;
  const match = /(\d+(?:[.,]\d+)?)/.exec(kedalaman);
  if (!match?.[1]) return null;
  const depth = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(depth) && inRange(depth, DEPTH_RANGE_KM.min, DEPTH_RANGE_KM.max)
    ? depth
    : null;
}

export function parseMagnitude(magnitude: string | undefined): number | null {
  if (typeof magnitude !== "string") return null;
  const value = Number.parseFloat(magnitude.replace(",", "."));
  return Number.isFinite(value) &&
    inRange(value, MAGNITUDE_RANGE.min, MAGNITUDE_RANGE.max)
    ? value
    : null;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6,
  agu: 7, ags: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
};

/**
 * Parses BMKG `Tanggal` ("16 Sep 2026", Indonesian month abbreviations) and `Jam` ("08:11:31 WIB")
 * into a UTC Date (WIB is UTC+7, no DST). Returns null when either part is unusable.
 */
export function parseWibDateTime(
  tanggal: string | undefined,
  jam: string | undefined,
): Date | null {
  if (typeof tanggal !== "string" || typeof jam !== "string") return null;
  const date = /^\s*(\d{1,2})[\s-]+([A-Za-z]{3})[A-Za-z]*[\s-]+(\d{4})\s*$/.exec(tanggal);
  const time = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:WIB)?\s*$/i.exec(jam);
  if (!date?.[1] || !date[2] || !date[3] || !time?.[1] || !time[2]) return null;
  const month = MONTHS[date[2].toLowerCase()];
  if (month === undefined) return null;
  const day = Number(date[1]);
  const year = Number(date[3]);
  const hours = Number(time[1]);
  const minutes = Number(time[2]);
  const seconds = Number(time[3] ?? 0);
  if (day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds > 59) return null;
  const wibAsUtc = Date.UTC(year, month, day, hours, minutes, seconds);
  const check = new Date(wibAsUtc);
  if (check.getUTCDate() !== day || check.getUTCMonth() !== month) return null;
  return new Date(wibAsUtc - WIB_OFFSET_MS);
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
  potensi: string | undefined | null,
): boolean | null {
  if (!potensi) return null;
  const normalized = potensi.toLowerCase();
  if (normalized.includes("tidak berpotensi tsunami")) return false;
  if (normalized.includes("berpotensi tsunami")) return true;
  return null;
}

export type GempaValidation =
  | { ok: true; event: NormalizedEarthquake; warnings: string[] }
  | { ok: false; reason: string };

/** Validates one raw BMKG item. DateTime (UTC) is the single source of truth for the event time. */
export function validateGempa(raw: BmkgGempaRaw, feed: BmkgFeedName): GempaValidation {
  const eventTime = new Date(raw?.DateTime ?? "");
  if (typeof raw?.DateTime !== "string" || Number.isNaN(eventTime.getTime())) {
    return { ok: false, reason: "invalid_datetime" };
  }
  const fromCoordinates = parseCoordinates(raw.Coordinates);
  const latitude = fromCoordinates?.latitude ?? parseLatitude(raw.Lintang);
  const longitude = fromCoordinates?.longitude ?? parseLongitude(raw.Bujur);
  if (latitude === null || longitude === null) {
    return { ok: false, reason: "invalid_coordinates" };
  }
  const magnitude = parseMagnitude(raw.Magnitude);
  if (magnitude === null) return { ok: false, reason: "invalid_magnitude" };
  const depthKm = parseDepthKm(raw.Kedalaman);
  if (depthKm === null) return { ok: false, reason: "invalid_depth" };

  const eventTimeUtc = eventTime.toISOString();
  const eventTimeWib = [raw.Tanggal, raw.Jam].filter(Boolean).join(" ").trim();
  const warnings: string[] = [];
  const wib = parseWibDateTime(raw.Tanggal, raw.Jam);
  if (wib && Math.abs(wib.getTime() - eventTime.getTime()) > TIME_MISMATCH_TOLERANCE_MS) {
    warnings.push(`time_mismatch: ${eventTimeWib} vs ${eventTimeUtc}`);
  }

  return {
    ok: true,
    warnings,
    event: {
      eventKey: eventKeyFor({ eventTimeUtc, latitude, longitude }),
      feed,
      eventTimeUtc,
      eventTimeWib,
      latitude,
      longitude,
      depthKm,
      magnitude,
      regionName: raw.Wilayah ?? "",
      potentialText: raw.Potensi ?? null,
      tsunamiPotential: classifyTsunamiPotential(raw.Potensi),
      feltText: raw.Dirasakan ?? null,
      feltReports: parseFeltReports(raw.Dirasakan),
      shakemapUrl: raw.Shakemap ? `${BMKG_SHAKEMAP_BASE_URL}${raw.Shakemap}` : null,
      source: "BMKG",
    },
  };
}

export function normalizeGempa(
  raw: BmkgGempaRaw,
  feed: BmkgFeedName,
): NormalizedEarthquake | null {
  const result = validateGempa(raw, feed);
  return result.ok ? result.event : null;
}

export function extractGempaList(payload: unknown): BmkgGempaRaw[] {
  const gempa = (payload as { Infogempa?: { gempa?: unknown } } | null)
    ?.Infogempa?.gempa;
  if (Array.isArray(gempa)) return gempa as BmkgGempaRaw[];
  if (gempa && typeof gempa === "object") return [gempa as BmkgGempaRaw];
  return [];
}

export interface ParsedFeed {
  events: NormalizedEarthquake[];
  /** Number of items that failed validation. */
  skipped: number;
  /** One reason per skipped item, e.g. "invalid_coordinates". */
  skipReasons: string[];
  /** Non-fatal findings on accepted items, e.g. "time_mismatch: ...". */
  warnings: string[];
}

export function parseFeedPayload(payload: unknown, feed: BmkgFeedName): ParsedFeed {
  const parsed: ParsedFeed = { events: [], skipped: 0, skipReasons: [], warnings: [] };
  for (const raw of extractGempaList(payload)) {
    const result = validateGempa(raw, feed);
    if (result.ok) {
      parsed.events.push(result.event);
      parsed.warnings.push(...result.warnings);
    } else {
      parsed.skipped += 1;
      parsed.skipReasons.push(result.reason);
    }
  }
  return parsed;
}
