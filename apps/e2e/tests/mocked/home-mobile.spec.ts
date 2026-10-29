import { expect, test } from "@playwright/test";
import { layoutShift, recordLayoutShift } from "../../support/layout-shift";
import { blockMapTiles, installStreamStub, mockApi } from "../../support/mock";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await recordLayoutShift(page);
  await blockMapTiles(page);
  await installStreamStub(page);
  await mockApi(page);
});

test("E16 on a 390x844 phone the map starts on the first screen, above the quake list", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-event-key]").first()).toBeVisible();
  const map = await page.getByRole("region", { name: "Peta gempa" }).boundingBox();
  const listHeading = await page.getByRole("heading", { name: "Gempa terbaru" }).boundingBox();
  expect(map!.y).toBeLessThan(844);
  expect(map!.y + map!.height).toBeLessThanOrEqual(listHeading!.y);
  // Selecting the newest quake after the list loads must not scroll the page down to the list.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("E16 on a 390x844 phone loading the list and the map shifts the layout by at most 0.05", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-event-key]").first()).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByTestId("latest-quake-loading")).toHaveCount(0);
  expect(await layoutShift(page)).toBeLessThanOrEqual(0.05);
});
