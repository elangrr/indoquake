import { expect, test } from "@playwright/test";
import { installStreamStub, mockApi } from "../../support/mock";
import { quakes } from "../../support/fixtures";
import { statistics } from "../../support/statistics";

test.beforeEach(async ({ page }) => {
  await installStreamStub(page);
});

test("E6 riwayat maps URL filters to API params, shows count, pager and detail links", async ({ page }) => {
  const many = Array.from({ length: 120 }, (_, index) => ({ ...quakes()[index % 8], eventKey: index.toString(16).padStart(16, "0") }));
  const log = await mockApi(page, { events: many });
  await page.goto("/riwayat?q=Sukabumi&minMag=4,5&maxDepth=70&from=2026-10-01&to=2026-10-28&province=jawa-barat&felt=1");
  await expect(page.getByTestId("history-count")).toHaveText("120 gempa");
  expect(Object.fromEntries(log.list.at(-1)!.searchParams)).toEqual({
    minMagnitude: "4.5",
    maxDepthKm: "70",
    from: "2026-09-30T17:00:00.000Z",
    to: "2026-10-28T16:59:59.999Z",
    province: "jawa-barat",
    felt: "true",
    q: "Sukabumi",
    page: "1",
    limit: "50",
  });
  await expect(page.locator("[data-event-key]")).toHaveCount(50);
  await expect(page.getByLabel("Nama tempat")).toHaveValue("Sukabumi");
  await page.getByRole("link", { name: "Berikutnya" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Halaman 2 dari 3")).toBeVisible();
  expect(log.list.at(-1)!.searchParams.get("page")).toBe("2");
});

test("E6 riwayat submits the form as URL params", async ({ page }) => {
  await mockApi(page);
  await page.goto("/riwayat");
  await page.getByLabel("Magnitudo min").fill("5");
  await page.getByLabel("Berpotensi tsunami").check();
  await page.getByRole("button", { name: "Terapkan" }).click();
  await expect(page).toHaveURL(/\/riwayat\?.*minMag=5.*tsunami=1/);
});

test("E6 riwayat empty state and error state with retry", async ({ page }) => {
  await mockApi(page, { events: [] });
  await page.goto("/riwayat?minMag=9");
  await expect(page.getByText("Tidak ada gempa yang cocok dengan filter ini.")).toBeVisible();
  await page.unrouteAll();
  const log = await mockApi(page, { listStatus: 503 });
  await page.goto("/riwayat");
  await expect(page.getByRole("alert").filter({ hasText: "Data belum bisa dimuat." })).toBeVisible();
  const before = log.list.length;
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect.poll(() => log.list.length).toBe(before + 1);
});

test("E7 statistik switches periods and gives every chart a text alternative", async ({ page }) => {
  const log = await mockApi(page, { statistics: statistics() });
  await page.goto("/statistik");
  await expect(page.getByTestId("stats-summary")).toContainText("145");
  await expect(page.getByRole("img", { name: /^Gempa per hari/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Gempa per bulan/ })).toBeVisible();
  const charts = page.locator("[role=img][aria-label]").filter({ has: page.locator("canvas") });
  await expect(charts).toHaveCount(6);
  await page.getByText("Lihat tabel").first().click();
  await expect(page.getByRole("cell", { name: "11" }).first()).toBeVisible();
  await page.getByRole("link", { name: "7 hari" }).click();
  await expect(page.getByRole("link", { name: "7 hari" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => log.statistics.at(-1)?.searchParams.get("period")).toBe("7d");
});

test("E7 statistik hides the month chart when byMonth is absent", async ({ page }) => {
  const body = statistics();
  delete (body.data as { byMonth?: unknown }).byMonth;
  await mockApi(page, { statistics: body });
  await page.goto("/statistik");
  await expect(page.getByTestId("stats-summary")).toBeVisible();
  await expect(page.getByRole("img", { name: /^Gempa per bulan/ })).toHaveCount(0);
});

test("E8 provinsi lists counts, the province page lists its quakes, an unknown slug is not found", async ({ page }) => {
  const log = await mockApi(page, { statistics: statistics("all") });
  await page.goto("/provinsi");
  await expect(page.getByTestId("count-jawa-barat")).toHaveText("18 gempa");
  await page.getByRole("link", { name: /Jawa Barat/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gempa Jawa Barat");
  await expect(page.locator("[data-event-key]").first()).toBeVisible();
  await expect.poll(() => log.list.map((url) => url.searchParams.get("province") ?? url.searchParams.get("nearProvince"))).toEqual(
    expect.arrayContaining(["jawa-barat", "jawa-barat"]),
  );
  await expect(page.getByRole("heading", { name: "Perairan dekat Jawa Barat" })).toBeVisible();
  await expect(page.locator("[data-event-key='4e7b10c9d2a83f66']").first()).toBeVisible();
  const response = await page.goto("/provinsi/atlantis");
  expect(response!.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
});

test("E11 with the database down the detail page shows the retry state without internal text", async ({ page }) => {
  await mockApi(page);
  await page.goto("/gempa/9c41d27a0b6e3f15");
  await expect(page.getByRole("alert").filter({ hasText: "Data belum bisa dimuat. Coba lagi." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Coba lagi" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("DATABASE_URL");
});

test("E11 a malformed quake key answers HTTP 404 with the Indonesian not-found page, no database call", async ({ page }) => {
  await mockApi(page);
  const response = await page.goto("/gempa/bukan-kunci");
  expect(response!.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await expect(page.getByText("Alamat ini tidak ada atau gempanya tidak tercatat.")).toBeVisible();
});

test("E12 notifikasi posts the subscription and shows the API message; test send reports success", async ({ page }) => {
  const log = await mockApi(page, {
    subscribe: { status: 400, body: { error: "URL webhook Discord tidak valid" } },
    subscribeTest: { status: 200, body: { ok: true } },
  });
  await page.goto("/notifikasi");
  const form = page.getByRole("region", { name: "Langganan Telegram atau Discord" });
  await form.getByRole("button", { name: "Discord" }).click();
  await page.getByLabel("URL Webhook Discord").fill("https://discord.com/api/webhooks/1290001/abcDEF");
  await page.getByRole("button", { name: "Simpan langganan" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "URL webhook Discord tidak valid" })).toBeVisible();
  await form.getByRole("button", { name: "Kirim notifikasi uji" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Notifikasi uji terkirim" })).toBeVisible();
  expect(log.posts.map((post) => post.path)).toEqual(["/api/v1/subscriptions", "/api/v1/subscriptions/test"]);
  expect(log.posts[1].body).toEqual({ channel: "discord", target: "https://discord.com/api/webhooks/1290001/abcDEF" });
});
