import type { GeoJSON as GeoJsonLayer, Map as LeafletMap, PathOptions } from "leaflet";
import { INDONESIA_BOUNDS, PROVINCE_TABLE, provinceBySlug } from "@indoquake/regions/meta";
import { tokenColor } from "./token-color";

type Leaflet = typeof import("leaflet");

/** Zoom from which the detailed outline of the provinces in view replaces the national one (AC 29). */
export const DETAIL_ZOOM = 7;
/** At most this many detailed outlines are loaded or shown at a time. */
export const MAX_DETAIL = 3;

const PANE = "provinsi";

/** [[south, west], [north, east]] of the whole archipelago. */
export function nationalBounds(): [[number, number], [number, number]] {
  return [
    [INDONESIA_BOUNDS.south, INDONESIA_BOUNDS.west],
    [INDONESIA_BOUNDS.north, INDONESIA_BOUNDS.east],
  ];
}

/** Writes the test hooks data-view and data-bounds ("south,west,north,east") on the map container. */
export function markView(map: LeafletMap, container: HTMLElement, view: "national" | "user" | "event" | "province") {
  container.dataset.view = view;
  const bounds = map.getBounds();
  container.dataset.bounds = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()]
    .map((value) => value.toFixed(3))
    .join(",");
}

function outlineStyle(container: HTMLElement): PathOptions {
  return { color: tokenColor(container, "--color-muted"), weight: 1, opacity: 0.7, fill: false, interactive: false };
}

/** Thin neutral outlines in their own pane under the quake markers; one canvas renderer. */
function ensurePane(L: Leaflet, map: LeafletMap) {
  if (!map.getPane(PANE)) {
    const pane = map.createPane(PANE);
    pane.style.zIndex = "350";
    pane.style.pointerEvents = "none";
  }
  return L.canvas({ pane: PANE });
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Province slugs whose bbox meets the view, nearest bbox centre first, at most MAX_DETAIL. */
export function provincesInView(view: { south: number; west: number; north: number; east: number }): string[] {
  const centerLat = (view.south + view.north) / 2;
  const centerLon = (view.west + view.east) / 2;
  return PROVINCE_TABLE.map((row) => provinceBySlug(row.slug))
    .filter((meta) => meta !== null)
    .filter((meta) => meta.bbox.maxLat >= view.south && meta.bbox.minLat <= view.north)
    .filter((meta) => meta.bbox.maxLon >= view.west && meta.bbox.minLon <= view.east)
    .map((meta) => {
      const lat = Math.max(meta.bbox.minLat, Math.min(centerLat, meta.bbox.maxLat));
      const lon = Math.max(meta.bbox.minLon, Math.min(centerLon, meta.bbox.maxLon));
      return { slug: meta.slug, distance: Math.hypot(lat - centerLat, lon - centerLon) };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_DETAIL)
    .map((item) => item.slug);
}

/**
 * National outlines (/geo/provinsi.json, once) plus the detailed outline of up to MAX_DETAIL provinces
 * in view from DETAIL_ZOOM (/geo/provinsi/<slug>.json, cached). Call after the map exists (D4).
 * The container reports data-province-layer = number of national features once they are drawn.
 */
export function attachProvinceLayers(L: Leaflet, map: LeafletMap, container: HTMLElement): () => void {
  let cancelled = false;
  const renderer = ensurePane(L, map);
  const style = outlineStyle(container);
  // Leaflet passes these options on to each polygon, so the renderer applies (its types omit it).
  const options = { style, renderer, interactive: false };
  const national = new Map<string, GeoJsonLayer>();
  const detail = new Map<string, GeoJsonLayer>();
  const loading = new Set<string>();

  const refreshDetail = () => {
    if (cancelled) return;
    const wanted = map.getZoom() >= DETAIL_ZOOM
      ? provincesInView({
          south: map.getBounds().getSouth(),
          west: map.getBounds().getWest(),
          north: map.getBounds().getNorth(),
          east: map.getBounds().getEast(),
        })
      : [];
    for (const [slug, layer] of detail) {
      const show = wanted.includes(slug);
      if (show && !map.hasLayer(layer)) layer.addTo(map);
      if (!show && map.hasLayer(layer)) layer.remove();
      national.get(slug)?.setStyle({ opacity: show ? 0 : style.opacity });
    }
    for (const slug of wanted) {
      if (detail.has(slug) || loading.has(slug)) continue;
      loading.add(slug);
      void fetchJson<GeoJSON.Feature>("/geo/provinsi/" + slug + ".json").then((feature) => {
        loading.delete(slug);
        if (cancelled || !feature) return;
        detail.set(slug, L.geoJSON(feature, options));
        refreshDetail();
      });
    }
  };

  void fetchJson<GeoJSON.FeatureCollection>("/geo/provinsi.json").then((collection) => {
    if (cancelled || !collection) return;
    for (const feature of collection.features) {
      const slug = String(feature.properties?.slug ?? "");
      national.set(slug, L.geoJSON(feature, options).addTo(map));
    }
    container.dataset.provinceLayer = String(collection.features.length);
    refreshDetail();
  });

  map.on("moveend", refreshDetail);
  return () => {
    cancelled = true;
    map.off("moveend", refreshDetail);
    for (const layer of [...national.values(), ...detail.values()]) layer.remove();
  };
}

/** The detailed outline of one province (province page): fetched once, fitted to its bbox. */
export function attachSingleProvince(L: Leaflet, map: LeafletMap, container: HTMLElement, slug: string): () => void {
  let cancelled = false;
  let layer: GeoJsonLayer | null = null;
  const renderer = ensurePane(L, map);
  const options = { style: outlineStyle(container), renderer, interactive: false };
  void fetchJson<GeoJSON.Feature>("/geo/provinsi/" + slug + ".json").then((feature) => {
    if (cancelled || !feature) return;
    layer = L.geoJSON(feature, options).addTo(map);
    container.dataset.provinceLayer = "1";
  });
  return () => {
    cancelled = true;
    layer?.remove();
  };
}
