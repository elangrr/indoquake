import { expect, test } from "@playwright/test";
import Redis from "ioredis";
import { EVENT_CHANNEL, HEARTBEAT_KEY } from "@indoquake/shared";
import { newQuake } from "../../support/fixtures";
import { persistNewQuake } from "../../support/live-quake";
import { watchStreamReady } from "../../support/stream-ready";

// Project `full`: real web server, PostGIS and Redis started by scripts/run-full.mjs
// (or e2e:serve + E2E_* env). Runs in the merge card; prints SKIP in the sandbox.
const REDIS_URL = process.env.E2E_REDIS_URL;
const DATABASE_URL = process.env.E2E_DATABASE_URL;
const SEEDED_KEY = process.env.E2E_SEEDED_KEY;

test.skip(!process.env.E2E_BASE_URL || !REDIS_URL || !DATABASE_URL, "full stack not running");

test("F1 server-rendered home shows seeded rows without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("[data-event-key]").first()).toBeVisible();
  expect(await page.locator("[data-event-key]").count()).toBeGreaterThan(10);
  await context.close();
});

test("F2 a quake stored with its event_log row and woken via Redis appears live", async ({ page }) => {
  const streamReady = await watchStreamReady(page);
  await page.goto("/");
  await expect(page.getByRole("status", { name: /^Status data:/ })).toBeVisible();
  await streamReady();
  const redis = new Redis(REDIS_URL!);
  try {
    const event = { ...newQuake(), eventKey: "f2f2f2f2f2f2f2f2" };
    const seq = await persistNewQuake(DATABASE_URL!, event);
    await redis.publish(EVENT_CHANNEL, JSON.stringify({ type: "earthquake:new", event, seq }));
    await expect(page.locator('[data-event-key="f2f2f2f2f2f2f2f2"]')).toBeVisible({ timeout: 15_000 });
  } finally {
    await redis.quit();
  }
});

test("F3 a stale heartbeat in Redis shows Tertunda", async ({ page }) => {
  const redis = new Redis(REDIS_URL!);
  const lastSuccessAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const feed = { fetched: false, events: 0, lastOkAt: lastSuccessAt, consecutiveFailures: 30 };
  await redis.set(
    HEARTBEAT_KEY,
    JSON.stringify({ at: new Date().toISOString(), ok: false, lastSuccessAt, feeds: { autogempa: feed, gempaterkini: feed, gempadirasakan: feed } }),
    "EX",
    900,
  );
  await page.goto("/");
  await expect(page.getByRole("status", { name: "Status data: Tertunda" })).toBeVisible({ timeout: 10_000 });
  await redis.quit();
});

test("F4 @needs-lane-a riwayat province, q and page against the real API", async ({ page }) => {
  await page.goto("/riwayat?province=papua&q=Jayapura&page=1");
  await expect(page.getByTestId("history-count")).toHaveText(/^\d+ gempa$/);
  const rows = page.locator("[data-event-key]");
  await expect(rows.first()).toBeVisible();
  await expect(rows.filter({ hasNotText: "Jayapura" })).toHaveCount(0);
});

test("F6 @needs-lane-a province page and sea filter against the real API (R137)", async ({ page }) => {
  await page.goto("/provinsi/papua-barat-daya");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gempa Papua Barat Daya");
  await expect(page.locator("[data-event-key]").first()).toContainText("Sorong");
  await page.goto("/riwayat?area=sea");
  const rows = page.locator("[data-event-key]");
  await expect(rows.first()).toBeVisible();
  await expect(rows.filter({ hasNotText: "Perairan dekat" })).toHaveCount(0);
});

test("F5 detail page renders a seeded quake on the server with HTTP 200", async ({ page }) => {
  test.skip(!SEEDED_KEY, "no seeded key");
  const response = await page.goto(`/gempa/${SEEDED_KEY}`);
  expect(response!.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pusat gempa");
  expect(await page.title()).toMatch(/^M\d\.\d /);
});

test("F5 a well-formed key that is not in the database answers HTTP 404 with the Indonesian not-found page", async ({ page }) => {
  const response = await page.goto("/gempa/ffffffffffffffff");
  expect(response!.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
});
