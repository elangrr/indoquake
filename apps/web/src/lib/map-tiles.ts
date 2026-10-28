import type { ThemeChoice } from "./theme";

/** The basemap for one theme. `filter` selects the CSS filter on the tile pane (globals.css). */
export interface TileSource {
  url: string;
  attribution: string;
  filter: "none" | "light" | "dark";
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`;

/**
 * Carto basemaps need a CARTO-issued key (without one every tile reads "API key required").
 * With a key: Carto light_all or dark_all. Without: OpenStreetMap standard tiles, tinted per
 * theme by a CSS filter on the tile pane only, so markers and overlays keep their colours.
 */
export function tileSource(theme: ThemeChoice, cartoApiKey: string | undefined): TileSource {
  if (cartoApiKey) {
    const style = theme === "dark" ? "dark_all" : "light_all";
    return {
      url: `https://basemaps.cartocdn.com/${style}/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoApiKey)}`,
      attribution: CARTO_ATTRIBUTION,
      filter: "none",
    };
  }
  return {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTRIBUTION,
    filter: theme,
  };
}
