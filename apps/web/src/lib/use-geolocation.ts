"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

export type GeoStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable"
  | "error";

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracyM: number;
  timestamp: number;
  source?: "gps" | "manual";
  label?: string;
}

const STORAGE_KEY = "indoquake:user-location";

export function readStoredUserLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    return parseLocation(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function parseLocation(raw: string | null): UserLocation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserLocation;
    if (
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function subscribeStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getStoredSnapshot(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveLocation, setLiveLocation] = useState<UserLocation | null>(null);

  const storedRaw = useSyncExternalStore(
    subscribeStorage,
    getStoredSnapshot,
    getServerSnapshot,
  );
  const storedLocation = useMemo(() => parseLocation(storedRaw), [storedRaw]);
  const location = liveLocation ?? storedLocation;


  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setError("Browser tidak mendukung geolokasi.");
      return;
    }
    setStatus("requesting");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          timestamp: position.timestamp,
          source: "gps",
        };
        setLiveLocation(next);
        setStatus("granted");
        try {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // sessionStorage tidak tersedia
        }
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setStatus("denied");
          setError("Izin lokasi ditolak.");
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setStatus("unavailable");
          setError("Lokasi tidak tersedia.");
        } else {
          setStatus("error");
          setError(geoError.message || "Gagal mengambil lokasi.");
        }
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return;
    }
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        // D7: only an already granted permission locates on load; "prompt" never asks unprompted.
        if (result.state === "granted") request();
        else if (result.state === "denied") {
          setStatus((current) => (current === "granted" ? current : "denied"));
        }
      })
      .catch(() => undefined);
  }, [request]);

  const clear = useCallback(() => {
    setLiveLocation(null);
    setStatus("idle");
    setError(null);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // sessionStorage tidak tersedia
    }
  }, []);

  const setManual = useCallback(
    (latitude: number, longitude: number, label?: string) => {
      const next: UserLocation = {
        latitude,
        longitude,
        accuracyM: 0,
        timestamp: Date.now(),
        source: "manual",
        label,
      };
      setLiveLocation(next);
      setStatus("granted");
      setError(null);
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // sessionStorage tidak tersedia
      }
    },
    [],
  );

  return {
    status: location ? ("granted" as GeoStatus) : status,
    location,
    error,
    request,
    clear,
    setManual,
  };
}
