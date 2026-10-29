"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Circle,
  CircleMarker,
  LayerGroup,
  Map as LeafletMap,
  Marker,
} from "leaflet";
import { GEOBOUNDARIES_ATTRIBUTION, type EarthquakeEvent } from "@indoquake/shared";
import { provinceBySlug } from "@indoquake/regions/meta";
import {
  DEFAULT_VELOCITY_MODEL,
  parseMmiString,
} from "@indoquake/earthquake";
import { MAGNITUDE_BUCKETS, magnitudeColor, ringCount } from "@/lib/magnitude";
import { currentTheme } from "@/lib/theme";
import { tileSource } from "@/lib/map-tiles";
import { prefersReducedMotion } from "@/lib/motion";
import { mmiColor } from "@/lib/mmi-colors";
import { attachProvinceLayers, attachSingleProvince, markView, nationalBounds } from "@/lib/province-layer";
import { tokenColor } from "@/lib/token-color";
import { MapPlaceholder } from "./map-placeholder";
import type { ReplayState } from "@/lib/replay";
import type { FeltLocationPoint } from "@/lib/use-felt-locations";
import type { UserLocation } from "@/lib/use-geolocation";
import "leaflet/dist/leaflet.css";

const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;
/** Leaflet fades a loaded tile in over 200 ms and prunes 250 ms after the layer's load event. */
const LEAFLET_TILE_FADE_MS = 250;
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
  /** Event that just arrived live; its marker pulses for a few seconds. */
  pulseKey?: string | null;
  /** Province page: open on this province's bbox with its detailed outline instead of the national view. */
  province?: string;
  /** Home map: keep the national basemap poster over the map until Leaflet has painted its first tiles. */
  poster?: boolean;
}

type MapView = "national" | "user" | "event" | "province";

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
  pulseKey = null,
  province,
  poster = false,
}: EarthquakeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const selectedRef = useRef<CircleMarker | null>(null);
  const pulseRef = useRef<Marker | null>(null);
  const ringsRef = useRef<Marker | null>(null);
  const tileRef = useRef<import("leaflet").TileLayer | null>(null);
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
  const viewRef = useRef<MapView>(province ? "province" : "national");
  const selectionSeenRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tilesShown, setTilesShown] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let tilesShownTimer: number | undefined;
    const shockwave = shockwaveRef.current;

    void (async () => {
      try {
        const L = await import("leaflet");
        // Build the map in its own task, not in the one that evaluated Leaflet: two short tasks instead of one
        // long one keep the main thread responsive while the page settles (total blocking time).
        await new Promise((resolve) => setTimeout(resolve, 0));
        const container = containerRef.current;
        if (cancelled || !container) return;

        leafletRef.current = L;
        map = L.map(container, {
          zoomControl: true,
          attributionControl: true,
          preferCanvas: true,
        });
        mapRef.current = map;
        // National view (D7): the whole archipelago in the fixed-height container, so nothing shifts.
        const focus = province ? provinceBySlug(province) : null;
        map.fitBounds(
          focus
            ? [
                [focus.bbox.minLat, focus.bbox.minLon],
                [focus.bbox.maxLat, focus.bbox.maxLon],
              ]
            : nationalBounds(),
          { animate: false },
        );
        map.attributionControl.addAttribution("BMKG");
        map.attributionControl.addAttribution(GEOBOUNDARIES_ATTRIBUTION);
        const view = map;
        map.on("moveend", () => markView(view, container, viewRef.current));

        const tiles = tileSource(currentTheme(), CARTO_API_KEY);
        container.dataset.tileFilter = tiles.filter;
        tileRef.current = L.tileLayer(tiles.url, {
          attribution: tiles.attribution,
          maxZoom: 19,
        }).addTo(map);
        // First tiles in view loaded (failed ones count too). Leaflet then fades each new tile in over 200 ms.
        tileRef.current.once("load", () => {
          tilesShownTimer = window.setTimeout(() => {
            if (!cancelled) setTilesShown(true);
          }, LEAFLET_TILE_FADE_MS);
        });

        markersRef.current = L.layerGroup().addTo(map);
        selectedRef.current = L.circleMarker(map.getCenter(), {
          radius: 18,
          color: "#d9481c",
          weight: 2,
          fillColor: "#d9481c",
          fillOpacity: 0.12,
          interactive: false,
        });

        resizeObserver = new ResizeObserver(() => map?.invalidateSize());
        resizeObserver.observe(container);

        map.whenReady(() => {
          map?.invalidateSize();
          if (map) markView(map, container, viewRef.current);
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
      window.clearTimeout(tilesShownTimer);
      resizeObserver?.disconnect();
      resizeObserver = null;
      pulseRef.current?.remove();
      pulseRef.current = null;
      ringsRef.current?.remove();
      ringsRef.current = null;
      tileRef.current = null;
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
      setTilesShown(false);
    };
  }, [province]);

  useEffect(() => {
    const L = leafletRef.current;
    const group = markersRef.current;
    if (!L || !group || !ready) return;

    group.clearLayers();
    for (const event of events) {
      const marker = L.circleMarker([event.latitude, event.longitude], {
        radius: radiusFor(event.magnitude),
        color: "#16191b",
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
    // The first selection is the automatic one (newest quake after load): keep the opening view.
    const automatic = !selectionSeenRef.current;
    selectionSeenRef.current = true;
    if (automatic || province) return;
    viewRef.current = "event";
    const target: [number, number] = [selected.latitude, selected.longitude];
    const zoom = Math.max(map.getZoom(), 7);
    if (prefersReducedMotion()) map.setView(target, zoom, { animate: false });
    else map.flyTo(target, zoom, { duration: 0.6 });
  }, [selectedKey, events, ready, province]);

  useEffect(() => {
    if (!ready) return;
    const sync = () => {
      const tiles = tileSource(currentTheme(), CARTO_API_KEY);
      if (containerRef.current) containerRef.current.dataset.tileFilter = tiles.filter;
      tileRef.current?.setUrl(tiles.url);
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("indoquake:theme", sync);
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener("indoquake:theme", sync);
      media.removeEventListener("change", sync);
    };
  }, [ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;
    ringsRef.current?.remove();
    ringsRef.current = null;
    const selected = events.find((event) => event.eventKey === selectedKey);
    if (!selected) return;
    const rings = ringCount(selected.magnitude);
    const size = 40 + rings * 24;
    const html = Array.from(
      { length: rings },
      (_, index) => `<span class="iq-ring" style="animation-delay:${index * 300}ms"></span>`,
    ).join("");
    const icon = L.divIcon({
      className: "iq-ring-host",
      html: `<div data-rings="${rings}" style="position:relative;width:${size}px;height:${size}px">${html}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    ringsRef.current = L.marker([selected.latitude, selected.longitude], {
      icon,
      interactive: false,
      keyboard: false,
    }).addTo(map);
  }, [selectedKey, events, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !ready) return;

    pulseRef.current?.remove();
    pulseRef.current = null;
    const latest = pulseKey ? events.find((event) => event.eventKey === pulseKey) : undefined;
    if (!latest) return;

    const icon = L.divIcon({
      className: "",
      html: '<div class="iq-marker-pulse"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    pulseRef.current = L.marker([latest.latitude, latest.longitude], {
      icon,
      interactive: false,
      keyboard: false,
    }).addTo(map);
  }, [events, ready, pulseKey]);

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
      { icon, interactive: false, keyboard: false },
    ).addTo(map);

    if (userLocation.accuracyM > 0) {
      accuracyCircleRef.current = L.circle(
        [userLocation.latitude, userLocation.longitude],
        {
          radius: userLocation.accuracyM,
          color: "#3b82c4",
          weight: 1,
          fillColor: "#3b82c4",
          fillOpacity: 0.08,
          interactive: false,
        },
      ).addTo(map);
    }
  }, [userLocation, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || province) return;
    if (!userLocation) {
      // Location cleared: back to the whole archipelago.
      if (lastFlewRef.current === null) return;
      lastFlewRef.current = null;
      viewRef.current = "national";
      map.fitBounds(nationalBounds(), { animate: !prefersReducedMotion() });
      return;
    }
    if (lastFlewRef.current === userLocation.timestamp) return;
    lastFlewRef.current = userLocation.timestamp;
    viewRef.current = "user";
    const target: [number, number] = [userLocation.latitude, userLocation.longitude];
    const zoom = Math.max(map.getZoom(), 8);
    if (prefersReducedMotion()) map.setView(target, zoom, { animate: false });
    else map.flyTo(target, zoom, { duration: 0.9 });
  }, [userLocation, ready, province]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const container = containerRef.current;
    if (!L || !map || !container || !ready) return;
    // Outlines load after the map exists, when the browser is idle (D4): never in first-load JS.
    let detach: (() => void) | null = null;
    const attach = () => {
      detach = province ? attachSingleProvince(L, map, container, province) : attachProvinceLayers(L, map, container);
    };
    const win = window as Window;
    if (typeof win.requestIdleCallback === "function") {
      const handle = win.requestIdleCallback(attach, { timeout: 2_000 });
      return () => {
        win.cancelIdleCallback(handle);
        detach?.();
      };
    }
    const handle = window.setTimeout(attach, 200);
    return () => {
      window.clearTimeout(handle);
      detach?.();
    };
  }, [ready, province]);

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
      color: "#16191b",
      weight: 1,
      fillColor: "#ef4444",
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    // Reduced motion: no growing wave rings. The ETA panel still gives the arrival times as text.
    if (prefersReducedMotion()) return;
    const host = map.getContainer();
    const pColor = tokenColor(host, "--wave-p");
    const sColor = tokenColor(host, "--wave-s");
    replayPRef.current = L.circle(center, {
      radius: 0,
      color: pColor,
      weight: 1.5,
      fillColor: pColor,
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(map);
    replaySRef.current = L.circle(center, {
      radius: 0,
      color: sColor,
      weight: 1.5,
      fillColor: sColor,
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
        color: "#16191b",
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
      color: "#c9a227",
      weight: 1,
      dashArray: "4 6",
      fillColor: "#c9a227",
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
        L.marker(center, { icon, interactive: false, keyboard: false }).addTo(map),
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

  const showPoster = poster && !tilesShown && !error;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {showPoster && (
        <div className="pointer-events-none absolute inset-0">
          <MapPlaceholder poster />
        </div>
      )}
      {!ready && !error && !showPoster && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center text-sm text-muted">
          Memuat peta
        </div>
      )}
      {error && (
        <div role="alert" className="absolute inset-0 z-[600] flex items-center justify-center p-6 text-center text-sm text-danger">
          Peta belum bisa dimuat.
        </div>
      )}

      <div className="pointer-events-none absolute bottom-6 left-3 z-[600] rounded-sm border border-border bg-surface px-3 py-2 text-xs">
        <p className="mb-1 font-medium text-foreground">Magnitudo</p>
        <ul className="num space-y-0.5 text-muted">
          {MAGNITUDE_BUCKETS.map((bucket) => (
            <li key={bucket.label} className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bucket.color }} />
              {bucket.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
