import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { status } from "../../support/fixtures";
import { emit, installStreamStub, mockApi } from "../../support/mock";
import { statistics } from "../../support/statistics";

const ROUTES = ["/", "/riwayat", "/statistik", "/provinsi", "/notifikasi", "/gempa/9c41d27a0b6e3f15"];

async function open(page: Page, route: string) {
  await page.route("**/basemaps.cartocdn.com/**", (r) => r.abort());
  await installStreamStub(page);
  await mockApi(page, { statistics: statistics() });
  await page.goto(route);
  await emit(page, "ready", { at: new Date().toISOString(), lastEventId: 1 });
  await emit(page, "status", status("fresh", 10));
  await page.waitForLoadState("networkidle");
}

for (const scheme of ["light", "dark"] as const) {
  for (const route of ROUTES) {
    test(`E9 axe: no serious or critical violations on ${route} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await open(page, route);
      // @axe-core/playwright types come from its own playwright-core copy (newer than the
      // pinned 1.62.1); the runtime Page is compatible, only the declared types differ.
      const results = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const blocking = results.violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
      expect(blocking).toEqual([]);
    });
  }
}

test("E9 no visible text is smaller than 12 px on any route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ROUTES) {
    await open(page, route);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent!.trim() !== ""))
        .filter((el) => (el as HTMLElement).offsetParent !== null && parseFloat(getComputedStyle(el).fontSize) < 12)
        .map((el) => `${el.tagName}.${(el as HTMLElement).className}: ${el.textContent!.trim().slice(0, 30)}`),
    );
    expect(small, route).toEqual([]);
  }
});

test("E5 chips, buttons and pager links are at least 44 px at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/", "/statistik", "/riwayat"]) {
    await open(page, route);
    const tooSmall = await page.evaluate(() =>
      [...document.querySelectorAll("main button, main a[href], header button, nav a")]
        .filter((el) => (el as HTMLElement).offsetParent !== null && !el.closest(".leaflet-container, details table"))
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.height < 44 || box.width < 44)
        .map(({ el, box }) => `${el.tagName} "${el.textContent!.trim().slice(0, 24)}" ${Math.round(box.width)}x${Math.round(box.height)}`),
    );
    expect(tooSmall, route).toEqual([]);
  }
});

test("E10 keyboard focus ring is visible on header controls", async ({ page }) => {
  await open(page, "/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).toBe("solid");
});
