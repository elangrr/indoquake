"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Circle,
  CircleMarker,
  LayerGroup,
  Map as LeafletMap,
  Marker,
} from "leaflet";
import type { EarthquakeEvent } from "@indoquake/shared";
import {
  DEFAULT_VELOCITY_MODEL,
  parseMmiString,
} from "@indoquake/earthquake";
import { magnitudeColor } from "@/lib/magnitude";
import { mmiColor } from "@/lib/mmi-colors";
import type { ReplayState } from "@/lib/replay";
import type { FeltLocationPoint } from "@/lib/use-felt-locations";
import type { UserLocation } from "@/lib/use-geolocation";
import "leaflet/dist/leaflet.css";

const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;
const TILE_URL = CARTO_API_KEY
  ? `https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`
  : "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const JAVA_CENTER: [number, number] = [-7.3, 110.2];
const JAVA_ZOOM = 6;

function radiusFor(magnitude: number): number {
  return Math.min(18, Math.max(4, 3 + magnitude * 2.2));
}

interface EarthquakeMapProps {
  events: EarthquakeEvent[];
  selectedKey: string | null;
  onSelect: (eventKey: string) => void;
  userLocation: UserLocation | null;
  nearActive: boolean;
  radiusKm: number;
  replay: ReplayState | null;
  feltLocations: FeltLocationPoint[];
  epicenter: { latitude: number; longitude: number } | null;
  feltRadiusKm: number | null;
}

export function EarthquakeMap({
  events,
  selectedKey,
  onSelect,
  userLocation,
  nearActive,
  radiusKm,
  replay,
  feltLocations,
  epicenter,
  feltRadiusKm,
}: EarthquakeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const selectedRef = useRef<CircleMarker | null>(null);
  const pulseRef = useRef<Marker | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const accuracyCircleRef = useRef<Circle | null>(null);
  const radiusCircleRef = useRef<Circle | null>(null);
  const replayEpicenterRef = useRef<CircleMarker | null>(null);
  const replayPRef = useRef<Circle | null>(null);
  const replaySRef = useRef<Circle | null>(null);
  const replayTimerRef = useRef<number | null>(null);
  const feltLayerRef = useRef<LayerGroup | null>(null);
  const shockwaveRef = useRef<{
    markers: Marker[];
    boundary: Circle | null;
    applySize: (() => void) | null;
  }>({ markers: [], boundary: null, applySize: null });
  const lastFlewRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const shockwave = shockwaveRef.current;

    void (async () => {
      try {
        const L = await import("leaflet");
        const container = containerRef.current;
        if (cancelled || !container) return;

        leafletRef.current = L;
        map = L.map(container, {
          center: JAVA_CENTER,
          zoom: JAVA_ZOOM,
          zoomControl: true,
          attributionControl: true,
          preferCanvas: true,
        });
        mapRef.current = map;

        L.tileLayer(TILE_URL, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);

        markersRef.current = L.layerGroup().addTo(map);
        selectedRef.current = L.circleMarker(JAVA_CENTER, {
          radius: 18,
          color: "#38bdf8",
          weight: 2,
          fillColor: "#38bdf8",
          fillOpacity: 0.12,
          interactive: false,
        });

        resizeObserver = new ResizeObserver(() => map?.invalidateSize());
        resizeObserver.observe(container);

        map.whenReady(() => {
          map?.invalidateSize();
          setReady(true);
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      pulseRef.current?.remove();
      pulseRef.current = null;
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      accuracyCircleRef.current?.remove();
      accuracyCircleRef.current = null;
      radiusCircleRef.current?.remove();
      radiusCircleRef.current = null;
      replayEpicenterRef.current?.remove();
      replayEpicenterRef.current = null;
      replayPRef.current?.remove();
      replayPRef.current = null;
      replaySRef.current?.remove();
      replaySRef.current = null;
      if (replayTimerRef.current !== null) {
        window.clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      feltLayerRef.current?.remove();
      feltLayerRef.current = null;
      if (shockwave.applySize && map) {
        map.off("zoomend", shockwave.applySize);
      }
      for (const marker of shockwave.markers) marker.remove();
      shockwave.markers = [];
      shockwave.applySize = null;
      shockwave.boundary?.remove();
      shockwave.boundary = null;
      map?.remove();
      mapRef.current = null;
      markersRef.current = null;
      selectedRef.current = null;
      leafletRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const group = markersRef.current;
    if (!L || !group || !ready) return;

    group.clearLayers();
    for (const event of events) {
      const marker = L.circleMarker([event.latitude, event.longitude], {
        radius: radiusFor(event.magnitude),
        color: "#0b0f14",
        weight: 1,
        fillColor: magnitudeColor(event.magnitude),
        fillOpacity: 0.9,
      });
      marker.bindTooltip(
        `M${event.magnitude.toFixed(1)} · ${event.regionName}`,
        { direction: "top", className: "indoquake-tooltip" },
      );
      marker.on("click", () => onSelectRef.current(event.eventKey));
      group.addLayer(marker);
    }
  }, [events, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const ring = selectedRef.current;
    if (!map || !ring || !ready) return;

    const selected = events.find((event) => event.eventKey === selectedKey);
    if (!selected) {
      ring.remove();
      return;
    }
    ring.setLatLng([selected.latitude, selected.longitude]);
    if (!map.hasLayer(ring)) ring.addTo(map);
    map.flyTo(
      [selected.latitude, selected.longitude],
      Math.max(map.getZoom(), 7),
      { duration: 0.9 },
    );
  }, [selectedKey, events, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    pulseRef.current?.remove();
    pulseRef.current = null;
    const latest = events[0];
    if (!latest) return;

    const icon = L.divIcon({
      className: "",
      html: '<div class="indoquake-pulse"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    pulseRef.current = L.marker([latest.latitude, latest.longitude], {
      icon,
      interactive: false,
    }).addTo(map);
  }, [events, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    accuracyCircleRef.current?.remove();
    accuracyCircleRef.current = null;
    if (!userLocation) return;

    const icon = L.divIcon({
      className: "",
      html: '<div class="indoquake-user-dot"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    userMarkerRef.current = L.marker(
      [userLocation.latitude, userLocation.longitude],
      { icon, interactive: false },
    ).addTo(map);

    if (userLocation.accuracyM > 0) {
      accuracyCircleRef.current = L.circle(
        [userLocation.latitude, userLocation.longitude],
        {
          radius: userLocation.accuracyM,
          color: "#38bdf8",
          weight: 1,
          fillColor: "#38bdf8",
          fillOpacity: 0.08,
          interactive: false,
        },
      ).addTo(map);
    }
  }, [userLocation, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !userLocation) return;
    if (lastFlewRef.current === userLocation.timestamp) return;
    lastFlewRef.current = userLocation.timestamp;
    map.flyTo(
      [userLocation.latitude, userLocation.longitude],
      Math.max(map.getZoom(), 8),
      { duration: 0.9 },
    );
  }, [userLocation, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    radiusCircleRef.current?.remove();
    radiusCircleRef.current = null;
    if (!userLocation || !nearActive) return;

    radiusCircleRef.current = L.circle(
      [userLocation.latitude, userLocation.longitude],
      {
        radius: radiusKm * 1000,
        color: "#fbbf24",
        weight: 1,
        dashArray: "5 5",
        fillColor: "#fbbf24",
        fillOpacity: 0.05,
        interactive: false,
      },
    ).addTo(map);
  }, [userLocation, nearActive, radiusKm, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    replayEpicenterRef.current?.remove();
    replayEpicenterRef.current = null;
    replayPRef.current?.remove();
    replayPRef.current = null;
    replaySRef.current?.remove();
    replaySRef.current = null;
    if (replayTimerRef.current !== null) {
      window.clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    if (!replay) return;

    const center: [number, number] = [replay.latitude, replay.longitude];
    replayEpicenterRef.current = L.circleMarker(center, {
      radius: 5,
      color: "#0b0f14",
      weight: 1,
      fillColor: "#ef4444",
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    replayPRef.current = L.circle(center, {
      radius: 0,
      color: "#38bdf8",
      weight: 1.5,
      fillColor: "#38bdf8",
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(map);
    replaySRef.current = L.circle(center, {
      radius: 0,
      color: "#f97316",
      weight: 1.5,
      fillColor: "#f97316",
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(map);

    const maxQuakeSeconds = 300;
    replayTimerRef.current = window.setInterval(() => {
      const elapsedQuakeSeconds =
        ((Date.now() - replay.startedAtMs) / 1000) * replay.speed;
      replayPRef.current?.setRadius(
        DEFAULT_VELOCITY_MODEL.pVelocityKmS * elapsedQuakeSeconds * 1000,
      );
      replaySRef.current?.setRadius(
        DEFAULT_VELOCITY_MODEL.sVelocityKmS * elapsedQuakeSeconds * 1000,
      );
      if (elapsedQuakeSeconds >= maxQuakeSeconds) {
        if (replayTimerRef.current !== null) {
          window.clearInterval(replayTimerRef.current);
          replayTimerRef.current = null;
        }
      }
    }, 100);
  }, [replay, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    feltLayerRef.current?.remove();
    feltLayerRef.current = null;
    if (feltLocations.length === 0) return;

    const group = L.layerGroup();
    for (const point of feltLocations) {
      const value = parseMmiString(point.mmi)?.max ?? 3;
      const marker = L.circleMarker([point.latitude, point.longitude], {
        radius: 6,
        color: "#0b0f14",
        weight: 1,
        fillColor: mmiColor(value),
        fillOpacity: 0.85,
      });
      marker.bindTooltip(
        `MMI ${point.mmi} · ${point.place} (laporan BMKG)`,
        { direction: "top", className: "indoquake-tooltip" },
      );
      group.addLayer(marker);
    }
    group.addTo(map);
    feltLayerRef.current = group;
  }, [feltLocations, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    const state = shockwaveRef.current;
    if (state.applySize) {
      map.off("zoomend", state.applySize);
      state.applySize = null;
    }
    for (const marker of state.markers) marker.remove();
    state.markers = [];
    state.boundary?.remove();
    state.boundary = null;

    if (!epicenter || !feltRadiusKm || feltRadiusKm <= 0) return;

    const center = L.latLng(epicenter.latitude, epicenter.longitude);

    state.boundary = L.circle(center, {
      radius: feltRadiusKm * 1000,
      color: "#a3e635",
      weight: 1,
      dashArray: "4 6",
      fillColor: "#a3e635",
      fillOpacity: 0.03,
      interactive: false,
    }).addTo(map);

    const ringCount = 3;
    const periodSeconds = 5;
    for (let index = 0; index < ringCount; index += 1) {
      const icon = L.divIcon({
        className: "indoquake-shockwave-host",
        html: `<div class="indoquake-shockwave" style="animation-duration:${periodSeconds}s;animation-delay:${((index * periodSeconds) / ringCount).toFixed(2)}s"></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      state.markers.push(
        L.marker(center, { icon, interactive: false }).addTo(map),
      );
    }

    const applySize = () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;
      const bounds = center.toBounds(feltRadiusKm * 2000);
      const north = currentMap.latLngToContainerPoint(
        L.latLng(bounds.getNorth(), center.lng),
      );
      const origin = currentMap.latLngToContainerPoint(center);
      const pixelRadius = Math.max(8, north.distanceTo(origin));
      for (const marker of state.markers) {
        const host = marker.getElement();
        const element = host?.firstElementChild;
        if (!(element instanceof HTMLElement)) continue;
        element.style.width = `${pixelRadius * 2}px`;
        element.style.height = `${pixelRadius * 2}px`;
        element.style.marginLeft = `${-pixelRadius}px`;
        element.style.marginTop = `${-pixelRadius}px`;
      }
    };

    state.applySize = applySize;
    applySize();
    map.on("zoomend", applySize);
  }, [epicenter, feltRadiusKm, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {!ready && !error && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center text-xs text-muted">
          Memuat peta…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center p-6 text-center text-xs text-red-400">
          Peta gagal dimuat: {error}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-6 left-3 z-[600] rounded-lg border border-border bg-surface/90 px-3 py-2 text-[11px] backdrop-blur">
        <p className="mb-1 font-medium text-foreground">Magnitudo</p>
        <ul className="space-y-0.5 text-muted">
          <li>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#38bdf8]" />
            &lt; 3
          </li>
          <li>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#a3e635]" />
            3 – 4
          </li>
          <li>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
            4 – 5
          </li>
          <li>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            5 – 6
          </li>
          <li>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
            ≥ 6
          </li>
        </ul>
      </div>
    </div>
  );
}
