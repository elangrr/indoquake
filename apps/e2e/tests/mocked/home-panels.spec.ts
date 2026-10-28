import { expect, test, type Page } from "@playwright/test";
import { blockMapTiles, installStreamStub, mockApi } from "../../support/mock";

async function openHome(page: Page) {
  await blockMapTiles(page);
  await installStreamStub(page);
  await mockApi(page);
  await page.goto("/");
  await expect(page.locator("[data-event-key]").first()).toBeVisible();
}

test("E15 the tsunami status reads in sentence case with a visible word space", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openHome(page);
  await page.getByRole("button", { name: "Info dan estimasi" }).click();
  await page.locator("[data-event-key] button").first().click();
  const panel = page.locator("#info-estimasi");
  await expect(panel.getByRole("heading", { name: "Status tsunami" })).toBeVisible();
  const label = panel.getByText("Tidak berpotensi tsunami", { exact: true });
  await expect(label).toBeVisible();
  // The bug rendered "TIDAKBERPOTENSI": measure the rendered width of the space after "Tidak".
  const spaceWidth = await label.evaluate((element) => {
    const range = document.createRange();
    range.setStart(element.firstChild!, 5);
    range.setEnd(element.firstChild!, 6);
    return range.getBoundingClientRect().width;
  });
  // 12 px text: the bug measured 2 px, a readable word space is at least 2.75 px.
  expect(spaceWidth).toBeGreaterThanOrEqual(2.75);
  await expect(panel.getByRole("heading", { name: "Lokasi saya" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Estimasi waktu tiba" })).toBeVisible();
});

test("E15 desktop sidebar keeps the filter chips and the timeline axis on one line", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openHome(page);
  const filters = page.getByRole("group", { name: "Saring daftar" });
  const first = await filters.getByRole("button", { name: "Semua" }).boundingBox();
  const last = await filters.getByRole("button", { name: "Dekat saya" }).boundingBox();
  expect(last?.y).toBe(first?.y);
  const axisStart = await page.getByText("24 jam lalu", { exact: true }).boundingBox();
  const axisEnd = await page.getByText("Sekarang", { exact: true }).boundingBox();
  expect(axisStart?.height).toBeLessThan(24);
  expect(axisEnd?.y).toBe(axisStart?.y);
});
