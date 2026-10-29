import type { CSSProperties } from "react";
import { INDONESIA_BOUNDS } from "@indoquake/regions/meta";
import { mapPoster, posterCss, tileUrl, type PosterTile } from "@/lib/map-poster";
import { tileSource } from "@/lib/map-tiles";

const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;

// The home map region: at least 320 x 320 (phone width, min-h-80), at most 1024 wide (the lg grid column of
// max-w-screen-2xl minus the 32rem list), so Leaflet's national view is zoom 3 or 4.
const POSTER = mapPoster(INDONESIA_BOUNDS, {
  minZoom: 3,
  maxZoom: 4,
  minWidth: 320,
  minHeight: 320,
  maxWidth: 1024,
  maxHeight: 1080,
});
const POSTER_CSS = posterCss(POSTER, ".map-poster");
const LIGHT = tileSource("light", CARTO_API_KEY);
const DARK = tileSource("dark", CARTO_API_KEY);

/** Tiles grouped by zoom, then by row, for the zoom > row > tile markup that posterCss expects. */
const GROUPS = POSTER.zooms.map((zoom) => {
  const rows = new Map<number, PosterTile[]>();
  for (const tile of POSTER.tiles) {
    if (tile.zoom === zoom.zoom) rows.set(tile.y, [...(rows.get(tile.y) ?? []), tile]);
  }
  return { zoom: zoom.zoom, rows: [...rows] };
});

function tileStyle(tile: PosterTile): CSSProperties {
  const light = tileUrl(LIGHT.url, tile);
  const dark = tileUrl(DARK.url, tile);
  return {
    left: `calc(50% + ${tile.left}px)`,
    top: `calc(50% + ${tile.top}px)`,
    "--tile-light": `url(${light})`,
    ...(dark === light ? {} : { "--tile-dark": `url(${dark})` }),
  } as CSSProperties;
}

/**
 * The basemap of the national view as plain CSS backgrounds, painted with the first HTML before any map JS
 * (largest contentful paint on phones). Leaflet asks for the same tile URLs; EarthquakeMap keeps this poster over
 * the map until Leaflet's first tiles have loaded and faded in, so the basemap never blinks out.
 */
export function MapPoster() {
  return (
    <div aria-hidden="true" data-testid="map-poster" className="map-poster" data-tint={LIGHT.filter === "none" ? undefined : "osm"}>
      <style dangerouslySetInnerHTML={{ __html: POSTER_CSS }} />
      {GROUPS.map((group) => (
        <div key={group.zoom} className={`mp-z${group.zoom}`}>
          {group.rows.map(([y, tiles]) => (
            <div key={y} className={`mp-y${y}`}>
              {tiles.map((tile) => (
                <i key={tile.x} className={`mp-x${tile.x}`} style={tileStyle(tile)} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
