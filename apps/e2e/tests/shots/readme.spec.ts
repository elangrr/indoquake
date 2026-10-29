import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { status } from "../../support/fixtures";
import { blockMapTiles, emit, installStreamStub, mockApi } from "../../support/mock";
import { statistics } from "../../support/statistics";

// README screenshots (docs/screenshots). Mocked API data in the shape of the seeded e2e rows;
// map tiles load from the network (set SHOTS_OFFLINE=1 to block them).
const OUT = process.env.SHOTS_DIR ?? join(import.meta.dirname, "..", "..", "..", "..", "docs", "screenshots");

const SHOTS = [
  { name: "home-desktop-light", path: "/", width: 1366, height: 900, scheme: "light" },
  { name: "home-desktop-dark", path: "/", width: 1366, height: 900, scheme: "dark" },
  { name: "home-mobile-light", path: "/", width: 390, height: 844, scheme: "light" },
  { name: "home-mobile-dark", path: "/", width: 390, height: 844, scheme: "dark" },
  { name: "riwayat-desktop-light", path: "/riwayat", width: 1366, height: 900, scheme: "light" },
  { name: "statistik-mobile-dark", path: "/statistik", width: 390, height: 844, scheme: "dark" },
] as const;

// SHOTS_EXTRA=1 adds the review set (R137 lane B): a non-Java province page and statistik at both sizes and schemes.
const EXTRA = process.env.SHOTS_EXTRA === "1"
  ? (["light", "dark"] as const).flatMap((scheme) =>
      [
        { width: 1366, height: 900, size: "desktop" },
        { width: 390, height: 844, size: "mobile" },
      ].flatMap((view) => [
        { name: "provinsi-papua-barat-daya-" + view.size + "-" + scheme, path: "/provinsi/papua-barat-daya", width: view.width, height: view.height, scheme },
        { name: "statistik-all-" + view.size + "-" + scheme, path: "/statistik", width: view.width, height: view.height, scheme },
      ]),
    )
  : [];

for (const shot of [...SHOTS, ...EXTRA]) {
  test(`shot ${shot.name}`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: shot.width, height: shot.height });
    await page.emulateMedia({ colorScheme: shot.scheme, reducedMotion: "reduce" });
    if (process.env.SHOTS_OFFLINE === "1") await blockMapTiles(page);
    await installStreamStub(page);
    await mockApi(page, { statistics: statistics() });
    await page.goto(shot.path);
    await emit(page, "ready", { at: new Date().toISOString(), lastEventId: 120 });
    await emit(page, "status", status("fresh", 6));
    await expect(page.getByRole("status", { name: "Status data: Langsung" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    if (shot.path === "/") await expect(page.locator(".leaflet-container")).toHaveAttribute("data-province-layer", "38");
    if (shot.path === "/" && process.env.SHOTS_OFFLINE !== "1") {
      await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 10_000 });
    }
    await page.screenshot({ path: join(OUT, `${shot.name}.png`) });
  });
}
