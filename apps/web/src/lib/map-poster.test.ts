import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { INDONESIA_BOUNDS } from "@indoquake/regions/meta";
import { mapPoster, posterCss, tileUrl, visibleTiles } from "./map-poster";

// The home map region (see components/map-poster.tsx).
const POSTER = mapPoster(INDONESIA_BOUNDS, {
  minZoom: 3,
  maxZoom: 4,
  minWidth: 320,
  minHeight: 320,
  maxWidth: 1024,
  maxHeight: 1080,
});

const names = (width: number, height: number) =>
  visibleTiles(POSTER, width, height).map((tile) => `${tile.zoom}/${tile.x}/${tile.y}`);

describe("mapPoster", () => {
  it("switches zoom where Leaflet's fitBounds of the national bounds does", () => {
    expect(POSTER.zooms).toEqual([
      { zoom: 3, minWidth: 261.92, minHeight: 98.54 },
      { zoom: 4, minWidth: 523.83, minHeight: 197.09 },
    ]);
    expect(POSTER.ceiling).toEqual({ zoom: 5, minWidth: 1047.67, minHeight: 394.17 });
  });

  it.each([
    // Lighthouse mobile (412 wide, 60vh map): the 9 tiles Leaflet requested in the seeded R137 run.
    [412, 494, ["3/5/3", "3/6/3", "3/7/3", "3/5/4", "3/6/4", "3/7/4", "3/5/5", "3/6/5", "3/7/5"]],
    [
      800,
      600,
      [
        "4/11/6", "4/12/6", "4/13/6", "4/14/6",
        "4/11/7", "4/12/7", "4/13/7", "4/14/7",
        "4/11/8", "4/12/8", "4/13/8", "4/14/8",
        "4/11/9", "4/12/9", "4/13/9", "4/14/9",
      ],
    ],
    // Zoom 5 and up is past the layout's widest map: no poster, the plain placeholder stays.
    [1100, 900, []],
  ])("a %ix%i container shows tiles %j", (width, height, expected) => {
    expect(names(width, height)).toEqual(expected);
  });

  it("covers every container size of the home map with tiles that all overlap it", () => {
    fc.assert(
      fc.property(fc.integer({ min: 320, max: 1024 }), fc.integer({ min: 320, max: 1080 }), (width, height) => {
        const tiles = visibleTiles(POSTER, width, height);
        const lefts = tiles.map((tile) => tile.left);
        const tops = tiles.map((tile) => tile.top);
        expect(new Set(tiles.map((tile) => tile.zoom)).size).toBe(1);
        expect(Math.min(...lefts)).toBeLessThanOrEqual(-width / 2);
        expect(Math.max(...lefts) + 256).toBeGreaterThanOrEqual(width / 2);
        expect(Math.min(...tops)).toBeLessThanOrEqual(-height / 2);
        expect(Math.max(...tops) + 256).toBeGreaterThanOrEqual(height / 2);
        expect(tiles.every((tile) => tile.left < width / 2 && tile.left + 256 > -width / 2)).toBe(true);
        expect(tiles.every((tile) => tile.top < height / 2 && tile.top + 256 > -height / 2)).toBe(true);
      }),
      { seed: 137, numRuns: 100 },
    );
  });
});

describe("posterCss", () => {
  it("shows a zoom group only inside its container size range", () => {
    expect(posterCss(POSTER, ".p")).toContain(
      "@container (width >= 261.92px) and (height >= 98.54px) and (not ((width >= 523.83px) and (height >= 197.09px))){.p>.mp-z3{display:block}}",
    );
  });

  it("shows a column once the container is wide enough to reach it", () => {
    expect(posterCss(POSTER, ".p")).toContain("@container (width > 0px){.p>.mp-z3>*>.mp-x6{display:block}}");
  });
});

describe("tileUrl", () => {
  it("fills a Leaflet template", () => {
    expect(tileUrl("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { zoom: 3, x: 6, y: 4 })).toBe(
      "https://tile.openstreetmap.org/3/6/4.png",
    );
  });
});
