import { expect, test } from "@playwright/test";
import { BMKG_ATTRIBUTION, SAFETY_DISCLAIMER } from "@indoquake/shared";
import { installStreamStub, mockApi } from "../../support/mock";

const ROUTES = ["/", "/riwayat", "/statistik", "/provinsi", "/notifikasi"];

test.beforeEach(async ({ page }) => {
  await installStreamStub(page);
  await mockApi(page);
});

test("E13 footer shows the safety disclaimer and BMKG attribution on every page, titles have no dashes", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.getByTestId("safety-disclaimer")).toHaveText(SAFETY_DISCLAIMER);
    await expect(page.getByRole("link", { name: BMKG_ATTRIBUTION })).toHaveAttribute("href", "https://data.bmkg.go.id/gempabumi/");
    expect(await page.title()).not.toMatch(/[\u2013\u2014]| - /);
  }
});

test("E10 first Tab stop is the skip link and it moves focus to main", async ({ page }) => {
  await page.goto("/riwayat");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Lewati ke konten utama" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("E5 at 390 px the bottom bar reaches every section with 44 px targets and nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ROUTES) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, route).toBeLessThanOrEqual(0);
  }
  const nav = page.getByRole("navigation", { name: "Navigasi utama" }).filter({ visible: true });
  for (const label of ["Beranda", "Riwayat", "Statistik", "Provinsi", "Notifikasi"]) {
    const box = await nav.getByRole("link", { name: label }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await nav.getByRole("link", { name: "Statistik" }).click();
  await expect(page).toHaveURL(/\/statistik$/);
});

test("E5 body is not overflow hidden and the window scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("/");
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("E16 theme toggle persists in localStorage without a flash on reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/provinsi");
  await page.getByRole("button", { name: "Pakai tema gelap" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await expect(page.getByRole("button", { name: "Pakai tema terang" })).toBeVisible();
});

test("robots.txt and sitemap.xml answer 200", async ({ request }) => {
  expect((await request.get("/robots.txt")).status()).toBe(200);
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
});
