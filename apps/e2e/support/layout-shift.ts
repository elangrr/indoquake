import type { Page } from "@playwright/test";

/**
 * Cumulative layout shift as the browser reports it (layout-shift entries without recent input).
 * Call before page.goto; read with `layoutShift(page)`.
 */
export async function recordLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store = window as unknown as { __iqLayoutShift: number };
    store.__iqLayoutShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!entry.hadRecentInput) store.__iqLayoutShift += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

export async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __iqLayoutShift: number }).__iqLayoutShift);
}
