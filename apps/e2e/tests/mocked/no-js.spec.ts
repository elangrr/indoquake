import { expect, test } from "@playwright/test";

// Without JavaScript the server HTML is all a visitor gets: the main content must be in it,
// not a loading fallback that only client JS swaps in (streamed `<template id="B:...">` or a
// client-side-rendering bailout `<template data-dgst=...>`).
const CASES = [
  { path: "/", main: { role: "status", name: /^Status data:/ } },
  { path: "/riwayat", main: { role: "button", name: "Terapkan" } },
  { path: "/statistik", main: { role: "navigation", name: "Periode" } },
  { path: "/provinsi/papua", main: { role: "heading", name: "Gempa Papua" } },
  { path: "/provinsi/papua-barat-daya", main: { role: "heading", name: "Perairan dekat Papua Barat Daya" } },
] as const;

for (const { path, main } of CASES) {
  test(`E15 ${path} renders its main content without JavaScript and without a loading fallback`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto(path);
    const html = await response!.text();
    await expect(page.getByRole(main.role, { name: main.name })).toBeVisible();
    await expect(page.getByText("Memuat", { exact: true })).toHaveCount(0);
    expect(html.includes("<template"), "server HTML holds a client-only fallback").toBe(false);
    await context.close();
  });
}
