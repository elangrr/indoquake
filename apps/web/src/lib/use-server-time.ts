"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useServerTime() {
  const offsetRef = useRef(0);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sentAt = Date.now();
        const response = await fetch("/api/v1/time", { cache: "no-store" });
        const data = (await response.json()) as { now: string };
        const receivedAt = Date.now();
        const serverNow = new Date(data.now).getTime();
        if (Number.isFinite(serverNow)) {
          offsetRef.current =
            serverNow + (receivedAt - sentAt) / 2 - receivedAt;
          if (!cancelled) setSynced(true);
        }
      } catch {
        // sinkronisasi gagal: pakai jam lokal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = useCallback(() => Date.now() + offsetRef.current, []);

  return { now, synced };
}
