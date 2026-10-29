import { expect, test, type Page } from "@playwright/test";
import { blockMapTiles, installStreamStub, mockApi } from "../../support/mock";

// perf/lcp-90: before any map JS, the home map region paints the national view's basemap tiles (the LCP on
// phones). They must be exactly the tiles Leaflet loads for that view, at the same place.

const OSM = "https://tile.openstreetmap.org";

const CASES = [
  {
    viewport: { width: 390, height: 844 },
    tiles: ["3/5/3", "3/6/3", "3/7/3", "3/5/4", "3/6/4", "3/7/4", "3/5/5", "3/6/5", "3/7/5"],
    centre: "3/6/4",
  },
  {
    viewport: { width: 1280, height: 800 },
    tiles: [
      "4/11/6", "4/12/6", "4/13/6", "4/14/6",
      "4/11/7", "4/12/7", "4/13/7", "4/14/7",
      "4/11/8", "4/12/8", "4/13/8", "4/14/8",
      "4/11/9", "4/12/9", "4/13/9", "4/14/9",
    ],
    centre: "4/13/8",
  },
];

/** Shown poster tiles as "z/x/y" from their background URL, in document order. */
function posterTiles(page: Page) {
  return page.locator("[data-testid=map-poster] i").evaluateAll((tiles) =>
    tiles
      .filter((tile) => tile.checkVisibility())
      .map((tile) => getComputedStyle(tile).backgroundImage.replace(/^url\("?https:\/\/[^/]+\/(.+)\.png"?\)$/, "$1")),
  );
}

/** A tile's box relative to the map region (the list above it on phones has a different height without JS). */
async function boxInMap(page: Page, selector: string) {
  const region = await page.getByRole("region", { name: "Peta gempa" }).boundingBox();
  const tile = await page.locator(selector).boundingBox();
  return { x: tile!.x - region!.x, y: tile!.y - region!.y };
}

function leafletTiles(page: Page) {
  return page
    .locator("img.leaflet-tile")
    .evaluateAll((tiles) => tiles.map((tile) => (tile as HTMLImageElement).src.replace(/^https:\/\/[^/]+\/(.+)\.png$/, "$1")));
}

for (const { viewport, tiles, centre } of CASES) {
  test(`E18 at ${viewport.width}x${viewport.height} the first HTML paints the tiles Leaflet loads, in place`, async ({ browser }) => {
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport });
    const poster = await noJs.newPage();
    await blockMapTiles(poster);
    await poster.goto("/");
    expect(await posterTiles(poster)).toEqual(tiles);
    const posterBox = await boxInMap(poster, `[data-testid=map-poster] i[style*="${OSM}/${centre}.png"]`);
    await noJs.close();

    const withJs = await browser.newContext({ viewport });
    const page = await withJs.newPage();
    await blockMapTiles(page);
    await installStreamStub(page);
    await mockApi(page);
    await page.goto("/");
    await expect(page.locator(".leaflet-container")).toHaveAttribute("data-view", "national");
    await expect.poll(() => leafletTiles(page).then((list) => [...list].sort())).toEqual([...tiles].sort());
    const leafletBox = await boxInMap(page, `img.leaflet-tile[src="${OSM}/${centre}.png"]`);
    expect(Math.abs(leafletBox.x - posterBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(leafletBox.y - posterBox.y)).toBeLessThanOrEqual(1);
    await withJs.close();
  });
}
