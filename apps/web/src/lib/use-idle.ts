"use client";

import { useEffect, useState } from "react";

/** True once the browser is idle after hydration, so heavy widgets load after the first paint. */
export function useIdle(timeoutMs = 1_500): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const win = window as Window;
    if (typeof win.requestIdleCallback === "function") {
      const handle = win.requestIdleCallback(() => setIdle(true), { timeout: timeoutMs });
      return () => win.cancelIdleCallback(handle);
    }
    const handle = setTimeout(() => setIdle(true), 200);
    return () => clearTimeout(handle);
  }, [timeoutMs]);
  return idle;
}
