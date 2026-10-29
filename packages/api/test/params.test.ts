import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PROVINCE_OPTIONS } from "@indoquake/regions/meta";
import { escapeLike, pageMeta, parseAreaFilters, parseListParams } from "../src";

const parse = (query: string) => parseListParams(new URLSearchParams(query));

describe("parseListParams (A-14, D16)", () => {
  it("defaults to limit 100, page 1", () => {
    expect(parse("")).toEqual({ ok: true, query: { limit: 100, page: 1 } });
  });

  it.each([
    ["limit=0", 1],
    ["limit=9999", 500],
    ["limit=50.7", 50],
  ])("clamps %s to %i", (query, limit) => {
    expect(parse(query)).toMatchObject({ ok: true, query: { limit } });
  });

  it("maps every filter", () => {
    expect(
      parse(
        "minMagnitude=3&maxMagnitude=6.5&minDepthKm=0&maxDepthKm=70&from=2026-10-01T00:00:00%2B07:00&to=2026-10-28T00:00:00Z" +
          "&felt=true&tsunami=true&province=jawa-barat&q=Sukabumi&order=asc&page=2&limit=50",
      ),
    ).toEqual({
      ok: true,
      query: {
        minMagnitude: 3,
        maxMagnitude: 6.5,
        minDepthKm: 0,
        maxDepthKm: 70,
        fromUtc: "2026-09-30T17:00:00.000Z",
        toUtc: "2026-10-28T00:00:00.000Z",
        feltOnly: true,
        tsunamiOnly: true,
        provinceSlug: "jawa-barat",
        q: "Sukabumi",
        order: "asc",
        page: 2,
        limit: 50,
      },
    });
  });

  it.each([
    ["minMagnitude=abc", "Parameter tidak valid: minMagnitude"],
    ["maxDepthKm=1e", "Parameter tidak valid: maxDepthKm"],
    ["limit=lots", "Parameter tidak valid: limit"],
    ["page=0", "Parameter tidak valid: page"],
    ["page=1.5", "Parameter tidak valid: page"],
    ["page=1001&limit=100", "Parameter tidak valid: page"],
    ["from=2026-10-01", "Parameter tidak valid: from"],
    ["to=kemarin", "Parameter tidak valid: to"],
    ["q=a", "Parameter tidak valid: q"],
    ["order=random", "Parameter tidak valid: order"],
    ["province=atlantis", "Provinsi tidak dikenal"],
  ])("rejects %s with %s", (query, error) => {
    expect(parse(query)).toEqual({ ok: false, error });
  });
});

describe("province, area and nearProvince (AC 16, 17)", () => {
  it.each(PROVINCE_OPTIONS.map((province) => [province.slug]))("accepts province=%s", (slug) => {
    expect(parse(`province=${slug}`)).toEqual({ ok: true, query: { provinceSlug: slug, limit: 100, page: 1 } });
  });

  it.each([
    ["area=land", { area: "land" }],
    ["area=sea", { area: "sea" }],
    ["nearProvince=maluku", { nearProvinceSlug: "maluku" }],
    ["nearProvince=maluku&area=sea", { nearProvinceSlug: "maluku", area: "sea" }],
    ["province=papua&area=land", { provinceSlug: "papua", area: "land" }],
  ])("maps %s", (query, filters) => {
    expect(parse(query)).toEqual({ ok: true, query: { ...filters, limit: 100, page: 1 } });
  });

  it.each([
    ["area=x", "Parameter tidak valid: area"],
    ["area=LAND", "Parameter tidak valid: area"],
    ["province=papua&nearProvince=maluku", "Parameter tidak valid: area"],
    ["province=papua&area=sea", "Parameter tidak valid: area"],
    ["nearProvince=maluku&area=land", "Parameter tidak valid: area"],
    ["nearProvince=atlantis", "Provinsi tidak dikenal"],
    ["province=atlantis&area=x", "Provinsi tidak dikenal"],
  ])("rejects %s with %s", (query, error) => {
    expect(parse(query)).toEqual({ ok: false, error });
  });

  it("parseAreaFilters gives the statistics route the same rules", () => {
    expect(parseAreaFilters(new URLSearchParams("province=bali&area=land"))).toEqual({
      ok: true,
      filters: { provinceSlug: "bali", area: "land" },
    });
    expect(parseAreaFilters(new URLSearchParams("area=laut"))).toEqual({ ok: false, error: "Parameter tidak valid: area" });
  });

  it("any area value other than land or sea is a 400 on area (property)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }).filter((text) => !["land", "sea"].includes(text.trim()) && text.trim() !== ""),
        (text) => {
          expect(parse(new URLSearchParams({ area: text }).toString())).toEqual({ ok: false, error: "Parameter tidak valid: area" });
        },
      ),
      { seed: 137, numRuns: 100 },
    );
  });
});

describe("pageMeta", () => {
  it.each([
    [0, 1, 50, 0, { count: 0, limit: 50, page: 1, total: 0, totalPages: 1 }],
    [600, 2, 50, 50, { count: 50, limit: 50, page: 2, total: 600, totalPages: 12 }],
    [101, 3, 50, 1, { count: 1, limit: 50, page: 3, total: 101, totalPages: 3 }],
  ])("total %i page %i limit %i", (total, page, limit, count, expected) => {
    expect(pageMeta(total, page, limit, count)).toEqual(expected);
  });

  it("pages cover the total exactly once (property)", () => {
    fc.assert(
      fc.property(fc.nat(5000), fc.integer({ min: 1, max: 500 }), (total, limit) => {
        const { totalPages } = pageMeta(total, 1, limit, 0);
        expect((totalPages - 1) * limit < Math.max(total, 1)).toBe(true);
        expect(totalPages * limit >= total).toBe(true);
      }),
      { seed: 133, numRuns: 100 },
    );
  });
});

describe("escapeLike", () => {
  it.each([
    ["50%_off", "50\\%\\_off"],
    ["a\\b", "a\\\\b"],
    ["Sukabumi", "Sukabumi"],
  ])("%s becomes %s", (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });
});
