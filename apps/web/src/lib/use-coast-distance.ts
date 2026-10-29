"use client";

import { useEffect, useState } from "react";
import { distanceToCoastKm, loadCoastline } from "./coastline";

/** Km from the user to the nearest coast; null until the lazy coastline file has loaded (no row shown). */
export function useCoastDistance(location: { latitude: number; longitude: number } | null): number | null {
  const [result, setResult] = useState<{ key: string; km: number | null } | null>(null);
  const key = location ? location.latitude + "," + location.longitude : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [latitude, longitude] = key.split(",").map(Number);
    void loadCoastline().then((coastline) => {
      if (!cancelled && coastline) setResult({ key, km: distanceToCoastKm(latitude, longitude, coastline) });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return result && result.key === key ? result.km : null;
}
