const WIB_OFFSET_MS = 7 * 3_600_000;
const TIME_ZONE = "Asia/Jakarta";

function parts(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: TIME_ZONE, hour12: false, ...options }).format(
    new Date(iso),
  );
}

/** "08:11:31 WIB" */
export function formatWibClock(iso: string): string {
  return `${parts(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\./g, ":")} WIB`;
}

/** "08:11 WIB" */
export function formatWibHourMinute(iso: string): string {
  return `${parts(iso, { hour: "2-digit", minute: "2-digit" }).replace(/\./g, ":")} WIB`;
}

/** "16 Sep 2026, 08:11 WIB" */
export function formatWibDateTime(iso: string): string {
  const date = parts(iso, { day: "numeric", month: "short", year: "numeric" });
  return `${date}, ${formatWibHourMinute(iso)}`;
}

/** "Rabu, 16 September 2026 08:11:31 WIB" */
export function formatWibLong(iso: string): string {
  const date = parts(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${date} ${formatWibClock(iso)}`;
}

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
