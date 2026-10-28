import type { Page } from "@playwright/test";
import { SSE_EVENT_READY } from "@indoquake/shared";

type ReadyFlag = { __streamReady?: boolean };

/**
 * Call before page.goto. Marks the page when its real /api/v1/stream connection receives the
 * `ready` frame, which the hub sends after it has set its event_log cursor. Returns a function
 * that waits for that mark, so rows written afterwards are sent live.
 */
export async function watchStreamReady(page: Page): Promise<() => Promise<void>> {
  await page.addInitScript((readyEvent) => {
    const Native = window.EventSource;
    window.EventSource = class extends Native {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init);
        this.addEventListener(readyEvent, () => {
          (window as unknown as ReadyFlag).__streamReady = true;
        });
      }
    };
  }, SSE_EVENT_READY);
  return async () => {
    await page.waitForFunction(() => (window as unknown as ReadyFlag).__streamReady === true, undefined, { timeout: 15_000 });
  };
}
