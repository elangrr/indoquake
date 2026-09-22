"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EarthquakeEvent, EarthquakeStreamPayload } from "@indoquake/shared";
import { haversineKm } from "@indoquake/geo";
import { estimateFeltRadiusKm } from "@indoquake/earthquake";
import { tsunamiStatusFromPotential } from "@indoquake/tsunami";
import { matchesSubscription } from "@indoquake/notifications";
import { EarthquakeMap } from "./earthquake-map";
import { EventToasts, type ToastItem } from "./event-toasts";
import { EtaPanel } from "./eta-panel";
import { TsunamiPanel } from "./tsunami-panel";
import {
  applyFeedFilter,
  FeedPanel,
  type FeedFilter,
} from "./feed-panel";
import { LocationPanel } from "./location-panel";
import { distanceToCoastKm } from "@/lib/coastline";
import { buildDistanceMap, findNearest } from "@/lib/distances";
import { readNotifySettings } from "@/lib/notify-settings";
import { REPLAY_SPEED, type ReplayState } from "@/lib/replay";
import { useFeltLocations } from "@/lib/use-felt-locations";
import { readStoredUserLocation, useGeolocation } from "@/lib/use-geolocation";
import { useServerTime } from "@/lib/use-server-time";

const TOAST_DURATION_MS = 12_000;

function maybeNotifyBrowser(event: EarthquakeEvent): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (window.Notification.permission !== "granted") return;

  const settings = readNotifySettings();
  if (!settings.enabled) return;

  const location = readStoredUserLocation();
  const distanceKm = location
    ? haversineKm(
        { latitude: location.latitude, longitude: location.longitude },
        { latitude: event.latitude, longitude: event.longitude },
      )
    : null;

  const matched = matchesSubscription(
    {
      id: 0,
      channel: "browser",
      target: "browser",
      minMagnitude: settings.minMagnitude,
      maxDistanceKm: settings.maxDistanceKm,
      provinceSlug: null,
      tsunamiOnly: settings.tsunamiOnly,
      feltOnly: settings.feltOnly,
      locationLatitude: null,
      locationLongitude: null,
    },
    {
      eventKey: event.eventKey,
      magnitude: event.magnitude,
      depthKm: event.depthKm,
      latitude: event.latitude,
      longitude: event.longitude,
      regionName: event.regionName,
      eventTimeWib: event.eventTimeWib,
      feltText: event.feltText,
      tsunamiPotential: event.tsunamiPotential,
      provinceSlug: event.provinceSlug ?? null,
    },
    distanceKm,
  );
  if (!matched) return;

  try {
    const notification = new window.Notification(
      `Gempa M${event.magnitude.toFixed(1)} — ${event.regionName}`,
      {
        body: `Kedalaman ${event.depthKm} km · ${event.eventTimeWib}\nSumber: BMKG — notifikasi aplikasi, bukan peringatan resmi.`,
        tag: event.eventKey,
      },
    );
    notification.onclick = () => {
      window.focus();
    };
  } catch {
    // notifikasi gagal ditampilkan
  }
}

function mergeEvent(
  events: EarthquakeEvent[],
  incoming: EarthquakeEvent,
): EarthquakeEvent[] {
  const withoutIncoming = events.filter(
    (event) => event.eventKey !== incoming.eventKey,
  );
  return [incoming, ...withoutIncoming].sort(
    (a, b) =>
      new Date(b.eventTimeUtc).getTime() - new Date(a.eventTimeUtc).getTime(),
  );
}

export function Dashboard({
  initialEvents,
  dataError,
}: {
  initialEvents: EarthquakeEvent[];
  dataError: string | null;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [selectedKey, setSelectedKey] = useState<string | null>(
    initialEvents[0]?.eventKey ?? null,
  );
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [radiusKm, setRadiusKm] = useState(100);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [showFelt, setShowFelt] = useState(true);

  const { status, location, error, request, clear, setManual } =
    useGeolocation();
  const { now: serverNow } = useServerTime();
  const felt = useFeltLocations(selectedKey, showFelt);

  useEffect(() => {
    const source = new EventSource("/api/v1/stream");
    source.addEventListener("ready", () => setConnected(true));
    source.addEventListener("earthquake", (event) => {
      const message = event as MessageEvent<string>;
      let payload: EarthquakeStreamPayload;
      try {
        payload = JSON.parse(message.data) as EarthquakeStreamPayload;
      } catch {
        return;
      }
      setConnected(true);
      setEvents((previous) => mergeEvent(previous, payload.event));
      if (payload.type === "earthquake:new") {
        const toast: ToastItem = {
          id: `${payload.event.eventKey}-${Date.now()}`,
          event: payload.event,
        };
        setToasts((previous) => [toast, ...previous].slice(0, 3));
        window.setTimeout(() => {
          setToasts((previous) =>
            previous.filter((item) => item.id !== toast.id),
          );
        }, TOAST_DURATION_MS);
        maybeNotifyBrowser(payload.event);
      }
    });
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, []);

  const distances = useMemo(
    () => buildDistanceMap(events, location),
    [events, location],
  );

  const nearest = useMemo(
    () => findNearest(events, distances),
    [events, distances],
  );

  const selectedEvent = useMemo(
    () => events.find((event) => event.eventKey === selectedKey) ?? null,
    [events, selectedKey],
  );

  const selectedDistance = selectedKey
    ? (distances?.get(selectedKey) ?? null)
    : null;

  const activeReplay =
    replay && replay.eventKey === selectedKey ? replay : null;

  const epicenter = useMemo(
    () =>
      selectedEvent
        ? { latitude: selectedEvent.latitude, longitude: selectedEvent.longitude }
        : null,
    [selectedEvent],
  );

  const observedFeltRadiusKm = useMemo(() => {
    if (!selectedEvent || felt.locations.length === 0) return null;
    const epicenterPoint = {
      latitude: selectedEvent.latitude,
      longitude: selectedEvent.longitude,
    };
    let max = 0;
    for (const point of felt.locations) {
      const km = haversineKm(epicenterPoint, point);
      if (km > 1200) continue;
      if (km > max) max = km;
    }
    return max > 0 ? Math.round(max) : null;
  }, [selectedEvent, felt.locations]);

  const modelFeltRadiusKm = useMemo(
    () =>
      selectedEvent
        ? estimateFeltRadiusKm(selectedEvent.magnitude, selectedEvent.depthKm)
        : null,
    [selectedEvent],
  );

  const feltRadiusKm =
    observedFeltRadiusKm ??
    (modelFeltRadiusKm !== null && modelFeltRadiusKm > 0
      ? modelFeltRadiusKm
      : null);
  const feltRadiusSource: "bmkg" | "estimate" | null =
    observedFeltRadiusKm !== null
      ? "bmkg"
      : feltRadiusKm !== null
        ? "estimate"
        : null;

  const coastDistanceKm = useMemo(
    () =>
      location ? distanceToCoastKm(location.latitude, location.longitude) : null,
    [location],
  );

  const tsunamiInfo = selectedEvent
    ? tsunamiStatusFromPotential(selectedEvent.tsunamiPotential)
    : null;

  const filteredEvents = useMemo(() => {
    if (filter === "near") {
      if (!distances) return [];
      return events.filter(
        (event) =>
          (distances.get(event.eventKey)?.epicentralKm ?? Infinity) <= radiusKm,
      );
    }
    return applyFeedFilter(events, filter);
  }, [events, filter, distances, radiusKm]);

  const selectFromMap = useCallback(
    (eventKey: string) => {
      setSelectedKey(eventKey);
      setFilter((current) => {
        const event = events.find((item) => item.eventKey === eventKey);
        if (!event) return current;
        if (current === "near") {
          const distance = distances?.get(eventKey);
          if (distance && distance.epicentralKm <= radiusKm) return current;
          return "all";
        }
        return applyFeedFilter([event], current).length > 0 ? current : "all";
      });
    },
    [events, distances, radiusKm],
  );

  const toggleReplay = useCallback(() => {
    setReplay((current) => {
      if (current && current.eventKey === selectedKey) return null;
      const event = events.find((item) => item.eventKey === selectedKey);
      if (!event) return null;
      return {
        eventKey: event.eventKey,
        latitude: event.latitude,
        longitude: event.longitude,
        startedAtMs: Date.now(),
        speed: REPLAY_SPEED,
      };
    });
  }, [events, selectedKey]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {dataError && (
        <div className="border-b border-amber-500/50 bg-amber-500/10 px-4 py-2 text-[11px] leading-relaxed text-amber-200">
          <span className="font-semibold text-amber-300">
            ⚠️ DATA TIDAK TERSEDIA
          </span>{" "}
          Tidak dapat memuat data gempa dari server (koneksi database/tunnel).
          Periksa tunnel lalu muat ulang halaman.
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[45vh] w-full shrink-0 lg:h-full lg:min-h-0 lg:flex-1">
        <EarthquakeMap
          events={events}
          selectedKey={selectedKey}
          onSelect={selectFromMap}
          userLocation={location}
          nearActive={filter === "near"}
          radiusKm={radiusKm}
          replay={activeReplay}
          feltLocations={felt.locations}
          epicenter={epicenter}
          feltRadiusKm={activeReplay ? null : feltRadiusKm}
        />
        <EventToasts items={toasts} onSelect={selectFromMap} />
        {tsunamiInfo?.status === "potential" && selectedEvent && (
          <div className="absolute inset-x-3 top-3 z-[700] rounded-lg border border-red-500/70 bg-red-950/85 px-3 py-2 backdrop-blur">
            <p className="text-[11px] font-semibold text-red-300">
              ⚠️ BERPOTENSI TSUNAMI — STATUS RESMI BMKG
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-red-100/90">
              M{selectedEvent.magnitude.toFixed(1)} · {selectedEvent.regionName}.
              Ikuti arahan resmi BMKG/BPBD.
            </p>
          </div>
        )}
        <div className="pointer-events-none absolute right-3 bottom-3 z-[600] rounded-full border border-border bg-surface/90 px-2.5 py-1 text-[11px] text-muted backdrop-blur">
          {connected ? "Terhubung realtime" : "Menghubungkan realtime…"}
        </div>
      </div>
      <FeedPanel
        events={filteredEvents}
        totalCount={events.length}
        filter={filter}
        onFilterChange={setFilter}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        distances={distances}
        location={location}
        radiusKm={radiusKm}
        onRequestLocation={request}
        locationPanel={
          <LocationPanel
            status={status}
            location={location}
            error={error}
            nearest={nearest}
            radiusKm={radiusKm}
            coastDistanceKm={coastDistanceKm}
            onRadiusChange={setRadiusKm}
            onRequest={request}
            onClear={clear}
            onSetManual={setManual}
            onSelectEvent={selectFromMap}
          />
        }
        etaPanel={
          <EtaPanel
            event={selectedEvent}
            distance={selectedDistance}
            serverNow={serverNow}
            replay={activeReplay}
            onToggleReplay={toggleReplay}
            showFelt={showFelt}
            onToggleFelt={() => setShowFelt((current) => !current)}
            feltResolved={felt.locations.length}
            feltPending={felt.pending}
            feltRadiusKm={feltRadiusKm}
            feltRadiusSource={feltRadiusSource}
          />
        }
        tsunamiPanel={
          <TsunamiPanel
            event={selectedEvent}
            coastDistanceKm={coastDistanceKm}
          />
        }
      />
      </div>
    </div>
  );
}
