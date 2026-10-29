import { wibDayEndUtc, wibDayStartUtc } from "@indoquake/regions/meta";

/** /riwayat URL parameters (names unchanged since the first version). */
export interface HistoryFilters {
  q: string;
  minMag: string;
  maxMag: string;
  minDepth: string;
  maxDepth: string;
  from: string;
  to: string;
  province: string;
  /** "land" | "sea" | "" (all); R137 "Wilayah" select. */
  area: string;
  felt: boolean;
  tsunami: boolean;
  page: number;
}

export const HISTORY_PAGE_SIZE = 50;

type Readable = { get(name: string): string | null };

export function parseHistoryFilters(params: Readable): HistoryFilters {
  const text = (name: string) => (params.get(name) ?? "").trim();
  const page = Math.trunc(Number(params.get("page") ?? "1"));
  return {
    q: text("q"),
    minMag: text("minMag"),
    maxMag: text("maxMag"),
    minDepth: text("minDepth"),
    maxDepth: text("maxDepth"),
    from: text("from"),
    to: text("to"),
    province: text("province"),
    area: ["land", "sea"].includes(text("area")) ? text("area") : "",
    felt: params.get("felt") === "1",
    tsunami: params.get("tsunami") === "1",
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

function number(value: string): string | null {
  if (value === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? String(parsed) : null;
}

/** Maps the page filters to GET /api/v1/earthquakes parameters (section 5 of the contract). */
export function historyApiQuery(filters: HistoryFilters): string {
  const query = new URLSearchParams();
  const set = (name: string, value: string | null) => {
    if (value !== null && value !== "") query.set(name, value);
  };
  set("minMagnitude", number(filters.minMag));
  set("maxMagnitude", number(filters.maxMag));
  set("minDepthKm", number(filters.minDepth));
  set("maxDepthKm", number(filters.maxDepth));
  set("from", filters.from ? wibDayStartUtc(filters.from) : null);
  set("to", filters.to ? wibDayEndUtc(filters.to) : null);
  set("province", filters.province || null);
  // A province holds land events only, so province plus sea would be an empty 400: the province wins.
  set("area", filters.province && filters.area === "sea" ? null : filters.area || null);
  if (filters.felt) query.set("felt", "true");
  if (filters.tsunami) query.set("tsunami", "true");
  set("q", filters.q.length >= 2 ? filters.q.slice(0, 60) : null);
  query.set("page", String(filters.page));
  query.set("limit", String(HISTORY_PAGE_SIZE));
  return query.toString();
}

/** Link to another page of the same filtered list. */
export function historyPageHref(params: Readable & { forEach(cb: (value: string, key: string) => void): void }, page: number): string {
  const next = new URLSearchParams();
  params.forEach((value, key) => {
    if (key !== "page" && value) next.set(key, value);
  });
  if (page > 1) next.set("page", String(page));
  const query = next.toString();
  return query ? `/riwayat?${query}` : "/riwayat";
}
