"use client";

import { useEffect, useRef, useState } from "react";

export interface FeltLocationPoint {
  mmi: string;
  place: string;
  latitude: number;
  longitude: number;
}

interface FeltLocationsState {
  eventKey: string | null;
  locations: FeltLocationPoint[];
  pending: number;
}

const MAX_ATTEMPTS = 12;
const RETRY_DELAY_MS = 3000;
const EMPTY: { locations: FeltLocationPoint[]; pending: number } = {
  locations: [],
  pending: 0,
};

export function useFeltLocations(eventKey: string | null, enabled: boolean) {
  const [state, setState] = useState<FeltLocationsState>({
    eventKey: null,
    locations: [],
    pending: 0,
  });
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!eventKey || !enabled) return;

    let cancelled = false;
    let timer: number | null = null;
    attemptsRef.current = 0;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/v1/felt-locations?eventKey=${encodeURIComponent(eventKey)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const json = (await response.json()) as {
          data?: FeltLocationPoint[];
          meta?: { pending?: number };
        };
        if (cancelled) return;
        const pending = json.meta?.pending ?? 0;
        setState({ eventKey, locations: json.data ?? [], pending });
        attemptsRef.current += 1;
        if (pending > 0 && attemptsRef.current < MAX_ATTEMPTS) {
          timer = window.setTimeout(() => {
            void load();
          }, RETRY_DELAY_MS);
        }
      } catch {
        // abaikan — coba lagi pada pemilihan berikutnya
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [eventKey, enabled]);

  if (!enabled || !eventKey || state.eventKey !== eventKey) {
    return EMPTY;
  }
  return { locations: state.locations, pending: state.pending };
}
