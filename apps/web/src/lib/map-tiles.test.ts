import { describe, expect, it } from "vitest";
import { tileSource } from "./map-tiles";

const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

describe("tileSource", () => {
  it.each([
    ["light", undefined, OSM, "light"],
    ["dark", undefined, OSM, "dark"],
    ["dark", "", OSM, "dark"],
    ["light", "k-123", "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?key=k-123", "none"],
    ["dark", "k-123", "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=k-123", "none"],
  ] as const)("theme %s with key %j uses %s and tile filter %s", (theme, key, url, filter) => {
    expect(tileSource(theme, key)).toMatchObject({ url, filter });
  });

  it("credits OpenStreetMap contributors without a Carto key", () => {
    expect(tileSource("light", undefined).attribution).toContain("OpenStreetMap</a> contributors");
    expect(tileSource("light", undefined).attribution).not.toContain("CARTO");
  });

  it("credits CARTO and OpenStreetMap with a Carto key", () => {
    expect(tileSource("dark", "k-123").attribution).toContain("CARTO");
    expect(tileSource("dark", "k-123").attribution).toContain("OpenStreetMap");
  });
});
