import { expect, test, type Page } from "@playwright/test";
import { GEOBOUNDARIES_ATTRIBUTION } from "@indoquake/shared";
import { blockMapTiles, installStreamStub, JAYAPURA_AREA, mockApi } from "../../support/mock";
import { statistics } from "../../support/statistics";

// R137 lane B: national map, zones, lazy geometry, location rule (AC 24-29, 32, 36-38).

async function geoRequests(page: Page): Promise<string[]> {
  const urls: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/geo/")) urls.push(path);
  });
  return urls;
}

async function countGeolocationCalls(page: Page) {
  await page.addInitScript(() => {
    const calls = { count: 0 };
    (window as unknown as { __geoCalls: typeof calls }).__geoCalls = calls;
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (...args: Parameters<Geolocation["getCurrentPosition"]>) => {
      calls.count += 1;
      original(...args);
    };
  });
}

// INDONESIA_BOUNDS of @indoquake/regions/meta (R137 P0).
const INDONESIA_BOUNDS = { south: -11.1, west: 94.9, north: 6.2, east: 141.1 };

async function openCapitals(page: Page) {
  await page.getByRole("button", { name: "Info dan estimasi" }).click();
  await page.getByRole("button", { name: "Cari / Atur manual" }).click();
  return page.getByLabel("Ibu kota provinsi");
}

function bounds(text: string | null): number[] {
  return (text ?? "").split(",").map(Number);
}

test.beforeEach(async ({ page }) => {
  await blockMapTiles(page);
  await installStreamStub(page);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1366, height: 900 },
]) {
  test(`N1 at ${viewport.width}x${viewport.height} the map opens on the whole archipelago with 38 outlines`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApi(page);
    await page.goto("/");
    const map = page.locator(".leaflet-container");
    await expect(map).toHaveAttribute("data-view", "national");
    await expect(map).toHaveAttribute("data-province-layer", "38");
    const [south, west, north, east] = bounds(await map.getAttribute("data-bounds"));
    expect(south).toBeLessThanOrEqual(INDONESIA_BOUNDS.south);
    expect(west).toBeLessThanOrEqual(INDONESIA_BOUNDS.west);
    expect(north).toBeGreaterThanOrEqual(INDONESIA_BOUNDS.north);
    expect(east).toBeGreaterThanOrEqual(INDONESIA_BOUNDS.east);
  });
}

test("N2 times show in each event's zone and sea events read Perairan dekat", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Gempa terkini di Indonesia" })).toBeVisible();
  await expect(page.locator("#gempa-terkini + div dd").first()).toHaveText(/ WIT$/);
  await expect(page.locator("[data-event-key=\'a0d3c5e7f9b11234\']")).toContainText("WITA");
  await expect(page.locator("[data-event-key=\'17f2e4d6c8b0a9e1\']")).toContainText("Perairan dekat Maluku");
  await expect(page.locator("[data-event-key=\'4e7b10c9d2a83f66\']")).toContainText("WIB");
  await expect(page).toHaveTitle("Indoquake · Gempa terkini Indonesia");
});

test("N4 with permission prompt the page never asks for the location on load", async ({ page }) => {
  await countGeolocationCalls(page);
  const geo = await geoRequests(page);
  await mockApi(page);
  await page.goto("/");
  await expect(page.locator(".leaflet-container")).toHaveAttribute("data-province-layer", "38");
  expect(await page.evaluate(() => (window as unknown as { __geoCalls: { count: number } }).__geoCalls.count)).toBe(0);
  await expect(page.locator(".leaflet-container")).toHaveAttribute("data-view", "national");
  expect(geo.filter((path) => path === "/geo/provinsi.json")).toHaveLength(1);
  expect(geo.filter((path) => path === "/geo/garis-pantai.json")).toHaveLength(0);
  expect(geo.filter((path) => path.startsWith("/geo/provinsi/"))).toHaveLength(0);
});

test.describe("with location permission granted at Jayapura", () => {
  test.use({ permissions: ["geolocation"], geolocation: { latitude: -2.5337, longitude: 140.7181 } });

  test("N5 the map moves to the user's area without a click and loads the coastline", async ({ page }) => {
    const geo = await geoRequests(page);
    const log = await mockApi(page);
    await page.goto("/");
    const map = page.locator(".leaflet-container");
    await expect(map).toHaveAttribute("data-view", "user");
    await expect.poll(async () => {
      const [south, west, north, east] = bounds(await map.getAttribute("data-bounds"));
      return Math.abs((south + north) / 2 + 2.5337) < 0.5 && Math.abs((west + east) / 2 - 140.7181) < 0.5 && east - west < 10;
    }).toBe(true);
    await expect.poll(() => geo.includes("/geo/garis-pantai.json")).toBe(true);
    await expect.poll(() => geo.filter((path) => path.startsWith("/geo/provinsi/")).length).toBeGreaterThan(0);
    expect(geo.filter((path) => path.startsWith("/geo/provinsi/")).length).toBeLessThanOrEqual(3);
    await expect.poll(() => log.area.length).toBeGreaterThan(0);
  });
});

test("N6 the location panel offers the 38 provincial capitals in one select", async ({ page }) => {
  const log = await mockApi(page);
  await page.goto("/");
  const select = await openCapitals(page);
  await expect(select.locator("option:not([disabled])")).toHaveCount(38);
  await select.selectOption("nusa-tenggara-timur");
  await expect.poll(() => log.area.at(-1)?.searchParams.get("lat")).toBe("-10.1772");
});

test("N7 map attribution and footer credit BMKG and the province boundary sources", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const attribution = page.locator(".leaflet-control-attribution");
  await expect(attribution).toContainText("BMKG");
  await expect(attribution).toContainText(GEOBOUNDARIES_ATTRIBUTION);
  await expect(page.getByTestId("boundary-attribution")).toHaveText(GEOBOUNDARIES_ATTRIBUTION);
});

test("N8 /provinsi groups the 38 provinces under 7 island groups", async ({ page }) => {
  await mockApi(page, { statistics: statistics("all") });
  await page.goto("/provinsi");
  await expect(page.locator("main h2")).toHaveCount(7);
  await expect(page.locator("main a[href^='/provinsi/']")).toHaveCount(38);
  await expect(page.getByTestId("count-papua")).toHaveText("3 gempa");
});

test("N9 a province page lists land and nearby sea events with empty states and loads only its outline", async ({ page }) => {
  const geo = await geoRequests(page);
  const log = await mockApi(page, { events: [] });
  await page.goto("/provinsi/papua-barat-daya");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gempa Papua Barat Daya");
  await expect(page.getByText("Belum ada gempa tercatat di provinsi ini.")).toBeVisible();
  await expect(page.getByText("Belum ada gempa tercatat di perairan dekat provinsi ini.")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toHaveAttribute("data-province-layer", "1");
  expect(geo).toEqual(["/geo/provinsi/papua-barat-daya.json"]);
  expect(log.list.map((url) => url.searchParams.get("province") ?? "near:" + url.searchParams.get("nearProvince")).sort()).toEqual([
    "near:papua-barat-daya",
    "papua-barat-daya",
  ]);
});

test("N10 riwayat maps the Wilayah select to area= and groups the province select", async ({ page }) => {
  const log = await mockApi(page);
  await page.goto("/riwayat?area=sea");
  await expect(page.locator("select[name=area]")).toHaveValue("sea");
  await expect.poll(() => log.list.at(-1)?.searchParams.get("area")).toBe("sea");
  await expect(page.locator("select[name=province]").locator("optgroup")).toHaveCount(7);
  await expect(page.locator("select[name=province]").locator("option[value]:not([value=''])")).toHaveCount(38);
});

test("N11 statistik shows all 38 provinces and the sea total", async ({ page }) => {
  await mockApi(page, { statistics: statistics() });
  await page.goto("/statistik");
  await expect(page.getByTestId("stats-summary")).toContainText("Laut dan perairan");
  await expect(page.getByTestId("stats-summary")).toContainText("31");
  const provinces = page.locator("section").filter({ has: page.getByRole("heading", { name: "Per provinsi" }) });
  await provinces.getByText("Lihat tabel").click();
  await expect(provinces.locator("tbody tr")).toHaveCount(38);
});

const KUPANG_AREA = { data: { ...JAYAPURA_AREA.data, latitude: -10.1772, longitude: 123.607, provinceSlug: "nusa-tenggara-timur", provinceName: "Nusa Tenggara Timur", zone: "WITA" } };

for (const [name, area, zone] of [
  ["in the zone of the user's location", { status: 200, body: KUPANG_AREA }, "WITA"],
  ["in the event's zone when /api/v1/area fails", { status: 500, body: { error: "Data belum bisa dimuat" } }, "WIT"],
] as const) {
  test(`N12 ETA arrival times show ${name}`, async ({ page }) => {
    await mockApi(page, { area });
    await page.goto("/");
    await (await openCapitals(page)).selectOption("nusa-tenggara-timur");
    const row = page.locator("dt", { hasText: "Gelombang P tiba" }).locator("xpath=following-sibling::dd");
    await expect(row).toHaveText(new RegExp(` ${zone}$`));
  });
}

test("N13 GET /opengraph-image is a 1200x630 PNG", async ({ request }) => {
  const response = await request.get("/opengraph-image");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  const png = await response.body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});
