import { PROVINCE_OPTIONS } from "@indoquake/regions";

export const LIST_LIMIT_DEFAULT = 100;
export const LIST_LIMIT_MAX = 500;
export const LIST_OFFSET_MAX = 100_000;
const KNOWN_PROVINCES = new Set(PROVINCE_OPTIONS.map((province) => province.slug));
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

export interface ListQuery {
  limit?: number;
  page?: number;
  minMagnitude?: number;
  maxMagnitude?: number;
  minDepthKm?: number;
  maxDepthKm?: number;
  fromUtc?: string;
  toUtc?: string;
  feltOnly?: boolean;
  tsunamiOnly?: boolean;
  provinceSlug?: string;
  /** Case-insensitive substring of regionName; % and _ match literally. */
  q?: string;
  order?: "desc" | "asc";
}

export type ParsedList = { ok: true; query: Required<Pick<ListQuery, "limit" | "page">> & ListQuery } | { ok: false; error: string };

const invalid = (name: string): ParsedList => ({ ok: false, error: `Parameter tidak valid: ${name}` });

function present(params: URLSearchParams, name: string): string | null {
  const value = params.get(name);
  return value === null || value.trim() === "" ? null : value.trim();
}

/** GET /api/v1/earthquakes query string to a ListQuery, or the exact 400 message (A-14). */
export function parseListParams(params: URLSearchParams): ParsedList {
  const query: ListQuery = {};
  let limit = LIST_LIMIT_DEFAULT;
  let page = 1;

  const limitText = present(params, "limit");
  if (limitText !== null) {
    const value = Number(limitText);
    if (!Number.isFinite(value)) return invalid("limit");
    limit = Math.min(Math.max(Math.trunc(value), 1), LIST_LIMIT_MAX);
  }
  const pageText = present(params, "page");
  if (pageText !== null) {
    const value = Number(pageText);
    if (!Number.isInteger(value) || value < 1) return invalid("page");
    page = value;
  }
  if (page * limit > LIST_OFFSET_MAX) return invalid("page");

  for (const name of ["minMagnitude", "maxMagnitude", "minDepthKm", "maxDepthKm"] as const) {
    const text = present(params, name);
    if (text === null) continue;
    const value = Number(text);
    if (!Number.isFinite(value)) return invalid(name);
    query[name] = value;
  }
  for (const [name, key] of [["from", "fromUtc"], ["to", "toUtc"]] as const) {
    const text = present(params, name);
    if (text === null) continue;
    if (!ISO_INSTANT.test(text) || Number.isNaN(Date.parse(text))) return invalid(name);
    query[key] = new Date(text).toISOString();
  }
  if (params.get("felt") === "true") query.feltOnly = true;
  if (params.get("tsunami") === "true") query.tsunamiOnly = true;

  const province = present(params, "province");
  if (province !== null) {
    if (!KNOWN_PROVINCES.has(province)) return { ok: false, error: "Provinsi tidak dikenal" };
    query.provinceSlug = province;
  }
  const q = present(params, "q");
  if (q !== null) {
    if (q.length < 2 || q.length > 60) return invalid("q");
    query.q = q;
  }
  const order = present(params, "order");
  if (order !== null) {
    if (order !== "asc" && order !== "desc") return invalid("order");
    query.order = order;
  }
  return { ok: true, query: { ...query, limit, page } };
}

/** meta for a page: totalPages is at least 1 so an empty result still has a page 1. */
export function pageMeta(total: number, page: number, limit: number, count: number) {
  return { count, limit, page, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Escapes LIKE wildcards so user text matches literally (backslash is Postgres' default escape). */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
