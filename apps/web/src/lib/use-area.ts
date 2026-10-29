"use client";

import { useEffect, useState } from "react";
import type { AreaResponse } from "@indoquake/shared";

export type UserArea = AreaResponse["data"];

/**
 * The server's description of a location (province or sea, zone), from GET /api/v1/area.
 * Null while loading, without a location, or when the request fails (callers fall back).
 */
export function useArea(location: { latitude: number; longitude: number } | null): UserArea | null {
  const [area, setArea] = useState<{ key: string; data: UserArea } | null>(null);
  const key = location ? `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}` : null;

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const [lat, lon] = key.split(",");
    fetch(`/api/v1/area?lat=${lat}&lon=${lon}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<AreaResponse>) : null))
      .then((body) => {
        if (body?.data) setArea({ key, data: body.data });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [key]);

  return area && area.key === key ? area.data : null;
}
