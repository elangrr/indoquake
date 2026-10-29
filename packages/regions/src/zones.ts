// Time zones (D6): fixed offsets, no DST, no IANA zone database, so output is the same on every host.
// Client-safe: no geometry here.
import type { ZoneId } from "@indoquake/shared";

export type { ZoneId };

export interface ZoneInfo {
  id: ZoneId;
  offsetHours: number;
  label: string;
}

export const ZONES: Readonly<Record<ZoneId, ZoneInfo>> = {
  WIB: { id: "WIB", offsetHours: 7, label: "WIB UTC+7" },
  WITA: { id: "WITA", offsetHours: 8, label: "WITA UTC+8" },
  WIT: { id: "WIT", offsetHours: 9, label: "WIT UTC+9" },
};

export function isZoneId(value: unknown): value is ZoneId {
  return value === "WIB" || value === "WITA" || value === "WIT";
}

export type ZonedStyle = "clock" | "hourMinute" | "dateTime" | "long";

const HOUR_MS = 3_600_000;

// Building an Intl.DateTimeFormat is slow (a list of 100 quakes needs 200 per render); there are only a few
// option sets, so each formatter is built once.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", hour12: false, ...options });
    formatters.set(key, format);
  }
  return format;
}

/** Intl in UTC on an instant shifted by the zone offset: deterministic, needs no tz data. */
function shifted(iso: string, zone: ZoneId, options: Intl.DateTimeFormatOptions): string {
  const local = new Date(Date.parse(iso) + ZONES[zone].offsetHours * HOUR_MS);
  return formatter(options).format(local);
}

function clock(iso: string, zone: ZoneId, withSeconds: boolean): string {
  const options: Intl.DateTimeFormatOptions = withSeconds
    ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" };
  return `${shifted(iso, zone, options).replace(/\./g, ":")} ${zone}`;
}

/**
 * clock "08:11:31 WIT"; hourMinute "08:11 WIT"; dateTime "28 Okt 2026, 01:30 WIT";
 * long "Rabu, 16 September 2026 08:11:31 WIB".
 */
export function formatZoned(iso: string, zone: ZoneId, style: ZonedStyle): string {
  switch (style) {
    case "clock":
      return clock(iso, zone, true);
    case "hourMinute":
      return clock(iso, zone, false);
    case "dateTime":
      return `${shifted(iso, zone, { day: "numeric", month: "short", year: "numeric" })}, ${clock(iso, zone, false)}`;
    case "long":
      return `${shifted(iso, zone, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ${clock(iso, zone, true)}`;
  }
}

// National aggregates and date filters stay on WIB days (D6).
const WIB_OFFSET_MS = ZONES.WIB.offsetHours * HOUR_MS;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** First instant (UTC ISO) of a WIB calendar day "YYYY-MM-DD", or null when the text is not a valid day. */
export function wibDayStartUtc(day: string): string | null {
  const match = DAY_PATTERN.exec(day);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return new Date(utc - WIB_OFFSET_MS).toISOString();
}

/** Last millisecond (UTC ISO) of a WIB calendar day. */
export function wibDayEndUtc(day: string): string | null {
  const start = wibDayStartUtc(day);
  if (!start) return null;
  return new Date(Date.parse(start) + 86_400_000 - 1).toISOString();
}

/** WIB calendar day "YYYY-MM-DD" of a UTC instant. */
export function wibDayOf(iso: string): string {
  return new Date(Date.parse(iso) + WIB_OFFSET_MS).toISOString().slice(0, 10);
}
