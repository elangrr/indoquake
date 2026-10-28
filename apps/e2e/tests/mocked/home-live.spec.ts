import { expect, test, type Page } from "@playwright/test";
import { NEW_QUAKE_KEY, newQuake, status } from "../../support/fixtures";
import { emit, failStream, installStreamStub, mockApi, streamUrls } from "../../support/mock";

async function openHome(page: Page) {
  await page.route("**/basemaps.cartocdn.com/**", (route) => route.abort());
  await installStreamStub(page);
  const log = await mockApi(page);
  await page.goto("/");
  await expect(page.locator("[data-event-key]").first()).toBeVisible();
  return log;
}

async function ready(page: Page, lastEventId = 120) {
  await emit(page, "ready", { at: new Date().toISOString(), lastEventId });
}

test("E1 home shows the list, the status and the map placeholder, then the themed map", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openHome(page);
  await expect(page.getByRole("heading", { name: "Gempa terkini di Pulau Jawa" })).toBeVisible();
  await expect(page.locator("[data-event-key]")).toHaveCount(8);
  await expect(page.getByRole("status", { name: /^Status data:/ })).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator("img.leaflet-tile").first()).toHaveAttribute("src", /dark_all/);
  await page.getByRole("button", { name: "Pakai tema terang" }).click();
  await expect(page.locator("img.leaflet-tile").first()).toHaveAttribute("src", /light_all/);
});

test("E1 the page does not scroll by itself on load or when a live quake arrives", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  await ready(page);
  await emit(page, "earthquake", { type: "earthquake:new", event: newQuake(), seq: 121 }, "121");
  await expect(page.locator(`[data-event-key="${NEW_QUAKE_KEY}"]`)).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("E1 selecting a quake draws intensity rings by magnitude class", async ({ page }) => {
  await openHome(page);
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.locator('[data-event-key="c2e4a6b8d0f21357"] button').first().click();
  await expect(page.locator("[data-rings]")).toHaveAttribute("data-rings", "4");
});

test("E2 an earthquake:new frame inserts the row, announces once, shows a toast and pulses for 6 s", async ({ page }) => {
  await openHome(page);
  await ready(page);
  await emit(page, "earthquake", { type: "earthquake:new", event: newQuake(), seq: 121 }, "121");
  const row = page.locator(`[data-event-key="${NEW_QUAKE_KEY}"]`);
  await expect(row).toBeVisible({ timeout: 2_000 });
  await expect(page.locator("[data-event-key]").first()).toHaveAttribute("data-event-key", NEW_QUAKE_KEY);
  await expect(page.getByTestId("live-announcer")).toHaveText(
    "Gempa baru M4.6, Pusat gempa berada di laut 38 km BaratDaya Kab. Cilacap",
  );
  await expect(page.getByTestId("toast")).toHaveCount(1);
  await expect(row).toHaveAttribute("data-pulse", "true");
  expect(await row.evaluate((el) => getComputedStyle(el).animationName)).toBe("iq-pulse");
  await emit(page, "earthquake", { type: "earthquake:new", event: newQuake(), seq: 121 }, "121");
  await expect(page.getByTestId("toast")).toHaveCount(1);
  await expect(row).not.toHaveAttribute("data-pulse", "true", { timeout: 8_000 });
});

test("E2 with reduced motion the new row is marked without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  await ready(page);
  await emit(page, "earthquake", { type: "earthquake:new", event: newQuake(), seq: 121 }, "121");
  const row = page.locator(`[data-event-key="${NEW_QUAKE_KEY}"]`);
  await expect(row).toHaveAttribute("data-pulse", "true");
  expect(await row.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await expect(page.getByTestId("live-announcer")).toHaveText(/^Gempa baru M4\.6/);
});

test("E3 status frames move the indicator to stale and down with the banner, then recover", async ({ page }) => {
  await openHome(page);
  await ready(page);
  await emit(page, "status", status("fresh", 8));
  await expect(page.getByRole("status", { name: "Status data: Langsung" })).toBeVisible({ timeout: 2_000 });
  await emit(page, "status", status("stale", 240));
  await expect(page.getByRole("status", { name: "Status data: Tertunda" })).toBeVisible({ timeout: 2_000 });
  await emit(page, "status", status("down", 1_800));
  await expect(page.getByRole("status", { name: "Status data: Terputus" })).toBeVisible({ timeout: 2_000 });
  const banner = page.getByRole("alert").filter({ hasText: "Data BMKG belum diperbarui sejak" });
  await expect(banner).toContainText(/sejak \d{2}:\d{2} WIB\. Ikuti informasi resmi BMKG\./);
  await expect(banner.getByRole("link", { name: "Ikuti informasi resmi BMKG." })).toHaveAttribute("href", "https://www.bmkg.go.id/");
  await expect(page.locator("[data-event-key]")).toHaveCount(8);
  await emit(page, "status", status("fresh", 5));
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Status data: Langsung" })).toBeVisible();
});

test("E4 a dropped stream shows Terputus and reopens with lastEventId; resync refetches the list", async ({ page }) => {
  const log = await openHome(page);
  await ready(page, 120);
  await emit(page, "status", status("fresh", 8));
  await emit(page, "earthquake", { type: "earthquake:new", event: newQuake(), seq: 121 }, "121");
  await failStream(page);
  await expect(page.getByRole("status", { name: "Status data: Terputus" })).toBeVisible({ timeout: 2_000 });
  await expect.poll(() => streamUrls(page), { timeout: 5_000 }).toEqual(["/api/v1/stream", "/api/v1/stream?lastEventId=121"]);
  await ready(page, 121);
  const before = log.list.length;
  await emit(page, "resync", { reason: "gap" });
  await expect.poll(() => log.list.length).toBe(before + 1);
  expect(log.list.at(-1)!.search).toBe("?limit=100");
});
