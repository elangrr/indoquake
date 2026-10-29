/**
 * Static first paint of the national map view (LCP). Before Leaflet loads, the home map region shows the same
 * basemap tiles Leaflet will request for `fitBounds(nationalBounds())`, as CSS backgrounds positioned from the
 * container centre. Container queries pick the zoom Leaflet would pick for the container size and hide tiles
 * outside the container, so the browser fetches only the tiles Leaflet asks for again (from cache) a moment later.
 *
 * Maths follows Leaflet 1.9: EPSG:3857 with 256 px tiles, getBoundsZoom (zoomSnap 1, snapped within 1%),
 * centre = projected midpoint of the bounds, tile x visible when it overlaps [centre - w/2, centre + w/2].
 */

export const TILE_SIZE = 256;

export interface LatLonBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface PosterOptions {
  minZoom: number;
  maxZoom: number;
  /** Smallest container (CSS min sizes); tiles a zoom can never show at these sizes are left out. */
  minWidth: number;
  minHeight: number;
  /** Tiles are generated for containers up to this size; larger containers show the placeholder at the edges. */
  maxWidth: number;
  maxHeight: number;
}

/** One zoom level: active while the container is at least minWidth x minHeight and smaller than the next level. */
export interface PosterZoom {
  zoom: number;
  minWidth: number;
  minHeight: number;
}

/** One tile; `left`/`top` are px from the container centre; it is visible when width > needWidth and height > needHeight. */
export interface PosterTile {
  zoom: number;
  x: number;
  y: number;
  left: number;
  top: number;
  needWidth: number;
  needHeight: number;
}

export interface MapPoster {
  zooms: PosterZoom[];
  /** The level above maxZoom: from this container size on, no tile shows. */
  ceiling: PosterZoom;
  tiles: PosterTile[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Projected pixel point at zoom 0 (world is 256 px wide), as Leaflet's SphericalMercator + transformation. */
function project(lat: number, lon: number): { x: number; y: number } {
  const sin = Math.sin((lat * Math.PI) / 180);
  const mercY = Math.log((1 + sin) / (1 - sin)) / 2;
  return { x: ((lon + 180) / 360) * TILE_SIZE, y: (0.5 - mercY / (2 * Math.PI)) * TILE_SIZE };
}

export function mapPoster(bounds: LatLonBounds, options: PosterOptions): MapPoster {
  const sw = project(bounds.south, bounds.west);
  const ne = project(bounds.north, bounds.east);
  const width0 = ne.x - sw.x;
  const height0 = sw.y - ne.y;
  const centre0 = { x: (sw.x + ne.x) / 2, y: (sw.y + ne.y) / 2 };

  // Leaflet snaps a fractional zoom within 1% up before flooring: zoom z needs scale >= 2^(z - 0.005).
  const level = (zoom: number): PosterZoom => {
    const factor = 2 ** (zoom - 0.005);
    return { zoom, minWidth: round2(width0 * factor), minHeight: round2(height0 * factor) };
  };
  const zooms: PosterZoom[] = [];
  const tiles: PosterTile[] = [];
  for (let zoom = options.minZoom; zoom <= options.maxZoom; zoom += 1) {
    zooms.push(level(zoom));
    // The next level takes over once both sides reach it; with the other side always past it, this side is capped.
    const next = level(zoom + 1);
    const widest = options.minHeight >= next.minHeight ? Math.min(options.maxWidth, next.minWidth) : options.maxWidth;
    const tallest = options.minWidth >= next.minWidth ? Math.min(options.maxHeight, next.minHeight) : options.maxHeight;

    const scale = 2 ** zoom;
    const cx = centre0.x * scale;
    const cy = centre0.y * scale;
    const halfW = widest / 2;
    const halfH = tallest / 2;
    const lastIndex = scale - 1;
    const firstX = Math.floor((cx - halfW) / TILE_SIZE);
    const lastX = Math.ceil((cx + halfW) / TILE_SIZE) - 1;
    const firstY = Math.max(0, Math.floor((cy - halfH) / TILE_SIZE));
    const lastY = Math.min(lastIndex, Math.ceil((cy + halfH) / TILE_SIZE) - 1);
    for (let y = firstY; y <= lastY; y += 1) {
      for (let x = firstX; x <= lastX; x += 1) {
        const left = round2(x * TILE_SIZE - cx);
        const top = round2(y * TILE_SIZE - cy);
        tiles.push({
          zoom,
          x: ((x % scale) + scale) % scale,
          y,
          left,
          top,
          needWidth: round2(Math.max(2 * left, -2 * (left + TILE_SIZE), 0)),
          needHeight: round2(Math.max(2 * top, -2 * (top + TILE_SIZE), 0)),
        });
      }
    }
  }
  return { zooms, ceiling: level(options.maxZoom + 1), tiles };
}

/** Fills a Leaflet URL template ({z}/{x}/{y}; {s} and {r} are not used by our sources). */
export function tileUrl(template: string, tile: Pick<PosterTile, "zoom" | "x" | "y">): string {
  return template
    .replace("{z}", String(tile.zoom))
    .replace("{x}", String(tile.x))
    .replace("{y}", String(tile.y));
}

function zoomQuery(zoom: PosterZoom, next: PosterZoom): string {
  return `(width >= ${zoom.minWidth}px) and (height >= ${zoom.minHeight}px) and (not ((width >= ${next.minWidth}px) and (height >= ${next.minHeight}px)))`;
}

/**
 * Container-query CSS for the poster markup `scope > .mp-z{zoom} > .mp-y{y} > .mp-x{x}` (zoom group, tile row,
 * tile). `scope` must be a size container whose zoom groups, rows and tiles are display:none by default. A zoom
 * group shows while Leaflet would pick that zoom for the container, a row or tile while it overlaps the container.
 */
export function posterCss(poster: MapPoster, scope: string): string {
  const rules: string[] = [];
  poster.zooms.forEach((zoom, index) => {
    const next = poster.zooms[index + 1] ?? poster.ceiling;
    const group = `${scope}>.mp-z${zoom.zoom}`;
    rules.push(`@container ${zoomQuery(zoom, next)}{${group}{display:block}}`);
    const rows = new Map<number, number>();
    const columns = new Map<number, number>();
    for (const tile of poster.tiles) {
      if (tile.zoom !== zoom.zoom) continue;
      rows.set(tile.y, tile.needHeight);
      columns.set(tile.x, tile.needWidth);
    }
    for (const [y, need] of rows) rules.push(`@container (height > ${need}px){${group}>.mp-y${y}{display:block}}`);
    for (const [x, need] of columns) rules.push(`@container (width > ${need}px){${group}>*>.mp-x${x}{display:block}}`);
  });
  return rules.join("\n");
}

/** The tiles posterCss shows for a container of this size (the same conditions, for tests and tooling). */
export function visibleTiles(poster: MapPoster, width: number, height: number): PosterTile[] {
  const levels = [...poster.zooms, poster.ceiling];
  const active = poster.zooms.find((zoom, index) => {
    const next = levels[index + 1]!;
    const atLeast = (level: PosterZoom) => width >= level.minWidth && height >= level.minHeight;
    return atLeast(zoom) && !atLeast(next);
  });
  if (!active) return [];
  return poster.tiles.filter(
    (tile) => tile.zoom === active.zoom && width > tile.needWidth && height > tile.needHeight,
  );
}
