import { describe, expect, it } from "vitest";
import {
  INDONESIA_BOUNDS,
  PROVINCE_GROUPS,
  PROVINCE_OPTIONS,
  provinceBySlug,
} from "@indoquake/regions/meta";

describe("province table (AC 1)", () => {
  it("lists the 38 provinces in SPEC section 5 order", () => {
    expect(PROVINCE_OPTIONS.map((province) => province.slug)).toEqual([
      "aceh",
      "sumatera-utara",
      "sumatera-barat",
      "riau",
      "kepulauan-riau",
      "jambi",
      "sumatera-selatan",
      "kepulauan-bangka-belitung",
      "bengkulu",
      "lampung",
      "banten",
      "dki-jakarta",
      "jawa-barat",
      "jawa-tengah",
      "di-yogyakarta",
      "jawa-timur",
      "bali",
      "nusa-tenggara-barat",
      "nusa-tenggara-timur",
      "kalimantan-barat",
      "kalimantan-tengah",
      "kalimantan-selatan",
      "kalimantan-timur",
      "kalimantan-utara",
      "sulawesi-utara",
      "gorontalo",
      "sulawesi-tengah",
      "sulawesi-barat",
      "sulawesi-selatan",
      "sulawesi-tenggara",
      "maluku",
      "maluku-utara",
      "papua",
      "papua-barat",
      "papua-selatan",
      "papua-tengah",
      "papua-pegunungan",
      "papua-barat-daya",
    ]);
  });

  it.each([
    ["banten", "Banten"],
    ["dki-jakarta", "DKI Jakarta"],
    ["jawa-barat", "Jawa Barat"],
    ["jawa-tengah", "Jawa Tengah"],
    ["di-yogyakarta", "DI Yogyakarta"],
    ["jawa-timur", "Jawa Timur"],
    ["bali", "Bali"],
  ])("keeps the existing slug %s named %s", (slug, name) => {
    expect(provinceBySlug(slug)?.name).toBe(name);
  });

  it("returns null for an unknown slug", () => {
    expect(provinceBySlug("tidak-ada")).toBeNull();
  });

  it("groups the provinces under 7 island groups in display order", () => {
    expect(PROVINCE_GROUPS.map((group) => [group.name, group.slugs.length])).toEqual([
      ["Sumatera", 10],
      ["Jawa", 6],
      ["Bali dan Nusa Tenggara", 3],
      ["Kalimantan", 5],
      ["Sulawesi", 6],
      ["Maluku", 2],
      ["Papua", 6],
    ]);
  });

  it("gives the national bounds", () => {
    expect(INDONESIA_BOUNDS).toEqual({ south: -11.1, west: 94.9, north: 6.2, east: 141.1 });
  });
});
