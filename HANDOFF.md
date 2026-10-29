# HANDOFF (t_a2f35f0a LCP 78 -> 90, fix round t_6cb51688)

Branch perf/lcp-90 from main be7df52. Not pushed. Code tip 0f5394c (fix round; gate + e2e run there); this file
and the CODEMAP line are committed on top. Logs, reports, commit list, diff: _orchestrator/lcp90-indoquake/.

## LCP result (Lighthouse 13.6.0 npm, mobile preset, median of 3, measured at 7d1f264)
| | Before: host seeded be7df52 (Rocky) | After: sandbox seed-like 7d1f264 |
|---|---|---|
| Performance / a11y / BP / SEO | 78 / 100 / 96 / 100 | 95 / 100 / 96 / 100 (runs 95, 95, 95) |
| LCP / FCP | 4807 ms / ~1.0 s | 2819 ms / 762 ms |
| TBT / CLS | 240 ms / 0.045 | 119 ms / 0.016 |
| LCP element | OSM tile img.leaflet-tile after the Leaflet chunk | same tile as a CSS background of the map poster |
Seed-like = no Docker here: a proxy answers /api/v1 from e2e fixtures (100 events). Rocky: real seeded run on host.
BP 96 unchanged: image-size-responsive on 256 px OSM tiles at DPR 1.75 (pre-existing).

## What changed
- d678a1b LCP: lib/map-poster.ts + components/map-poster.tsx paint the national view's tiles as CSS backgrounds in
  the first HTML (container queries pick zoom 3/4 and the tiles in view). Unit lib/map-poster.test.ts, e2e E18.
- 47133e4 TBT: feed-panel.tsx memo rows; packages/regions/src/zones.ts caches Intl.DateTimeFormat per option set.
- 7d1f264 TBT: earthquake-map.tsx builds the Leaflet map in its own task after the chunk evaluates.
- 0f5394c fix (review t_2c90ad0f M1, basemap blinked out while the map loaded): EarthquakeMap has a `poster` prop
  (dashboard.tsx passes it). It keeps MapPlaceholder with the poster over the Leaflet container (pointer-events
  none, same absolute box, so no layout shift) until the tile layer's first `load` + 250 ms (Leaflet's tile fade).
  Failed tiles count as loaded, so offline the poster still goes. E19 (mocked/map-poster.spec.ts) holds the tile
  requests, counts animation frames without a poster (0), then releases them and expects the poster gone.
  E19 fails on the old components (poster not found after map ready) and passes on 0f5394c.
- No feature or copy changes; Indonesian strings and READMEs untouched.

## How to test (sandbox: NEXT_BUILD_CPUS=4, npm_config_cache set, else thread limit / EACCES)
- bash scripts/gate.sh: GATE PASS at 0f5394c (typecheck, lint 0, web unit 178/178, regions 198/198, build).
- npm run test:e2e (mocked) at 0f5394c: 78 passed, 2 failed with "Target crashed" (a11y /statistik, /provinsi,
  sandbox Chromium); a11y.spec.ts re-run alone 17/17. map-poster.spec.ts alone 3/3 (E18 x2, E19).
- Rocky host: look at the home map with mobile throttling; the basemap must not blink between poster and tiles.

## Open / fragile
- Lighthouse not re-run after 0f5394c (the overlay is absolute in the same box, so CLS cannot move; LCP element
  is still the poster tile). LCP 2.8 s is above B-19's 2.5 s; next lever: preload the LCP tile.
- Review Low (not fixed, out of card scope): poster sizes copy dashboard.tsx classes (max 1080 px tall); map
  regions taller than that show only the grid at the edges. E18 guards 390 and 1280 viewports.
