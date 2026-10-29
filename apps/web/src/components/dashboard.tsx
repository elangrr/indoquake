"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EarthquakeEvent, EarthquakeListResponse } from "@indoquake/shared";
import { haversineKm } from "@indoquake/geo";
import { estimateFeltRadiusKm } from "@indoquake/earthquake";
import { tsunamiStatusFromPotential } from "@indoquake/tsunami";
import { matchesSubscription } from "@indoquake/notifications";
import { EventToasts, type ToastItem } from "./event-toasts";
import { LatestQuake } from "./latest-quake";
import { useLive } from "./live-provider";
import { MapPlaceholder } from "./map-placeholder";
import { EtaPanel } from "./eta-panel";
import { TsunamiPanel } from "./tsunami-panel";
import {
  applyFeedFilter,
  FeedPanel,
  type FeedFilter,
} from "./feed-panel";
import { LocationPanel } from "./location-panel";
import { ErrorState } from "./error-state";
import { useCoastDistance } from "@/lib/use-coast-distance";
import { mergeEvent, mergeEvents } from "@/lib/merge-event";
import { useArea } from "@/lib/use-area";
import { zoneOfEvent } from "@indoquake/regions/meta";
import { useIdle } from "@/lib/use-idle";
import { buildDistanceMap, findNearest } from "@/lib/distances";
import { readNotifySettings } from "@/lib/notify-settings";
import { REPLAY_SPEED, type ReplayState } from "@/lib/replay";
import { useFeltLocations } from "@/lib/use-felt-locations";
import { readStoredUserLocation, useGeolocation } from "@/lib/use-geolocation";
import { useServerTime } from "@/lib/use-server-time";

const EarthquakeMap = dynamic(
  () => import("./earthquake-map").then((module) => module.EarthquakeMap),
  { ssr: false, loading: () => <MapPlaceholder /> },
);

const TOAST_DURATION_MS = 12_000;
const PULSE_MS = 6_000;
const LIST_URL = "/api/v1/earthquakes?limit=100";

async function loadList(): Promise<EarthquakeEvent[] | null> {
  try {
    const response = await fetch(LIST_URL, { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as EarthquakeListResponse;
    return Array.isArray(body.data) ? body.data : null;
  } catch {
    return null;
  }
}

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
      `Gempa M${event.magnitude.toFixed(1)}, ${event.regionName}`,
      {
        body: `Kedalaman ${event.depthKm} km\nSumber: BMKG. Notifikasi aplikasi, bukan peringatan resmi.`,
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

export function Dashboard({
  initialEvents,
  dataError,
}: {
  initialEvents: EarthquakeEvent[];
  dataError: boolean;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [selectedKey, setSelectedKey] = useState<string | null>(
    initialEvents[0]?.eventKey ?? null,
  );
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pulseKey, setPulseKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [listError, setListError] = useState(false);
  const timers = useRef(new Set<number>());
  const mapAllowed = useIdle();
  const live = useLive();
  const [radiusKm, setRadiusKm] = useState(100);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [showFelt, setShowFelt] = useState(true);

  const { status, location, error, request, clear, setManual } =
    useGeolocation();
  const userArea = useArea(location);
  const { now: serverNow } = useServerTime();
  const felt = useFeltLocations(selectedKey, showFelt);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of pending) window.clearTimeout(id);
      pending.clear();
    };
  }, []);

  const applyList = useCallback((list: EarthquakeEvent[] | null) => {
    if (!list) {
      setListError(true);
      return;
    }
    setEvents((previous) => mergeEvents(previous, list));
    setSelectedKey((current) => current ?? list[0]?.eventKey ?? null);
    setListError(false);
  }, []);

  const refetch = useCallback(() => {
    void loadList().then(applyList);
  }, [applyList]);

  // The server render could not read the database: load the list from the API instead.
  useEffect(() => {
    if (!dataError) return;
    let cancelled = false;
    void loadList().then((list) => {
      if (!cancelled) applyList(list);
    });
    return () => {
      cancelled = true;
    };
  }, [dataError, applyList]);

  useEffect(() => live.onResync(refetch), [live, refetch]);

  useEffect(
    () =>
      live.onEarthquake((payload) => {
        setEvents((previous) => mergeEvent(previous, payload.event));
        if (payload.type !== "earthquake:new") return;
        const event = payload.event;
        setPulseKey(event.eventKey);
        later(() => setPulseKey((current) => (current === event.eventKey ? null : current)), PULSE_MS);
        setAnnouncement(`Gempa baru M${event.magnitude.toFixed(1)}, ${event.regionName}`);
        const toast: ToastItem = { id: `${event.eventKey}-${payload.seq ?? Date.now()}`, event };
        setToasts((previous) => [toast, ...previous.filter((item) => item.event.eventKey !== event.eventKey)].slice(0, 3));
        later(() => setToasts((previous) => previous.filter((item) => item.id !== toast.id)), TOAST_DURATION_MS);
        maybeNotifyBrowser(event);
      }),
    [live, later],
  );

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

  const coastDistanceKm = useCoastDistance(location);

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

  const mapProps = {
    events,
    selectedKey,
    onSelect: selectFromMap,
    userLocation: location,
    nearActive: filter === "near",
    radiusKm,
    replay: activeReplay,
    feltLocations: felt.locations,
    epicenter,
    feltRadiusKm: activeReplay ? null : feltRadiusKm,
    pulseKey,
  };

  // Phones read the latest quake, then the map, then the list. Desktop: latest quake and list in the
  // left column, the map sticky on the right across both rows.
  return (
    <div className="mx-auto w-full max-w-screen-2xl lg:grid lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      <p aria-live="polite" role="status" className="sr-only" data-testid="live-announcer">
        {announcement}
      </p>
      <EventToasts items={toasts} onSelect={selectFromMap} />
      <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:border-r lg:border-border">
        <LatestQuake
          event={events[0] ?? null}
          events={events}
          loading={dataError && events.length === 0 && !listError}
          error={listError && events.length === 0 ? <ErrorState onRetry={refetch} /> : null}
        />
        {tsunamiInfo?.status === "potential" && selectedEvent && (
          <div role="alert" className="mx-4 mb-4 border-l-2 border-danger bg-danger-soft px-4 py-3">
            <p className="text-sm font-semibold text-danger">Berpotensi tsunami, status resmi BMKG</p>
            <p className="mt-1 text-sm text-foreground">
              M{selectedEvent.magnitude.toFixed(1)}, {selectedEvent.regionName}. Ikuti arahan resmi BMKG dan BPBD.
            </p>
          </div>
        )}
      </div>
      <div
        aria-label="Peta gempa"
        role="region"
        className="relative h-[60vh] min-h-80 border-t border-border lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-[calc(100dvh-3.5rem)] lg:self-start lg:border-t-0"
      >
        {mapAllowed ? <EarthquakeMap {...mapProps} /> : <MapPlaceholder />}
      </div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:border-r lg:border-border">
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
          pulseKey={pulseKey}
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
              timeZone={userArea?.zone ?? (selectedEvent ? zoneOfEvent(selectedEvent) : "WIB")}
            />
          }
          tsunamiPanel={<TsunamiPanel event={selectedEvent} coastDistanceKm={coastDistanceKm} />}
        />
      </div>
    </div>
  );
}
