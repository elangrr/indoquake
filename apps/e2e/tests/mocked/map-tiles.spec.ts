import { expect, test } from "@playwright/test";
import { installStreamStub, mockApi } from "../../support/mock";

test("E17 without a CARTO key the map loads OpenStreetMap tiles and credits OpenStreetMap", async ({ page }) => {
  const tileHosts = new Set<string>();
  await page.route("**/tile.openstreetmap.org/**", (route) => {
    tileHosts.add(new URL(route.request().url()).host);
    return route.abort();
  });
  await page.route("**/basemaps.cartocdn.com/**", (route) => {
    tileHosts.add(new URL(route.request().url()).host);
    return route.abort();
  });
  await installStreamStub(page);
  await mockApi(page);
  await page.goto("/");
  const attribution = page.locator(".leaflet-control-attribution");
  await expect(attribution).toBeVisible();
  await expect(attribution.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/copyright",
  );
  await expect(attribution).not.toContainText("CARTO");
  await expect.poll(() => [...tileHosts]).toEqual(["tile.openstreetmap.org"]);
});
