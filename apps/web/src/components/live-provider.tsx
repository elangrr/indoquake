"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  DataFreshness,
  EarthquakeStreamPayload,
  HealthResponse,
} from "@indoquake/shared";
import { createLiveFeed, type ConnectionState } from "@/lib/live-feed";
import { freshnessFromHealth, freshnessState } from "@/lib/data-status";

type EarthquakeListener = (payload: EarthquakeStreamPayload) => void;
type ResyncListener = () => void;

interface LiveContextValue {
  freshness: DataFreshness | null;
  connection: ConnectionState;
  onEarthquake: (listener: EarthquakeListener) => () => void;
  onResync: (listener: ResyncListener) => () => void;
}

const LiveContext = createContext<LiveContextValue | null>(null);

export function useLive(): LiveContextValue {
  const value = useContext(LiveContext);
  if (!value) throw new Error("useLive outside LiveProvider");
  return value;
}

const AGE_TICK_MS = 15_000;

export function LiveProvider({ children }: { children: ReactNode }) {
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const earthquakeListeners = useRef(new Set<EarthquakeListener>());
  const resyncListeners = useRef(new Set<ResyncListener>());

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/health", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json() as Promise<HealthResponse>)
      .then((health) => {
        if (health && health.checks) {
          setFreshness((current) => current ?? freshnessFromHealth(health, Date.now()));
        }
      })
      .catch(() => undefined);

    const feed = createLiveFeed({
      createSource: (url) => new EventSource(url),
      onConnection: setConnection,
      onStatus: (status) =>
        setFreshness({
          state: status.state,
          lastSuccessAt: status.lastSuccessAt,
          ageSeconds: status.ageSeconds,
          latestEventAt: status.latestEventAt,
        }),
      onEarthquake: (payload) => {
        setFreshness((current) =>
          current && (!current.latestEventAt || current.latestEventAt < payload.event.eventTimeUtc)
            ? { ...current, latestEventAt: payload.event.eventTimeUtc }
            : current,
        );
        for (const listener of earthquakeListeners.current) listener(payload);
      },
      onResync: () => {
        for (const listener of resyncListeners.current) listener();
      },
    });

    // Freshness ages on the client between status frames (stale after 90 s, down after 600 s).
    const tick = window.setInterval(() => {
      if (document.hidden) return;
      setFreshness((current) => {
        if (!current?.lastSuccessAt) return current;
        const state = freshnessState(current.lastSuccessAt, Date.now());
        return state === current.state ? current : { ...current, state };
      });
    }, AGE_TICK_MS);

    return () => {
      controller.abort();
      feed.close();
      window.clearInterval(tick);
    };
  }, []);

  const onEarthquake = useCallback((listener: EarthquakeListener) => {
    earthquakeListeners.current.add(listener);
    return () => {
      earthquakeListeners.current.delete(listener);
    };
  }, []);

  const onResync = useCallback((listener: ResyncListener) => {
    resyncListeners.current.add(listener);
    return () => {
      resyncListeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({ freshness, connection, onEarthquake, onResync }),
    [freshness, connection, onEarthquake, onResync],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
