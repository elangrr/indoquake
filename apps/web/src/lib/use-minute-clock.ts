"use client";

import { useSyncExternalStore } from "react";

let minuteNow = Date.now();

function subscribe(onChange: () => void): () => void {
  minuteNow = Date.now();
  const id = window.setInterval(() => {
    minuteNow = Date.now();
    onChange();
  }, 60_000);
  return () => window.clearInterval(id);
}

/** Current time, refreshed once a minute on the client; null during the server render. */
export function useMinuteClock(): number | null {
  return useSyncExternalStore(subscribe, () => minuteNow, () => null);
}
