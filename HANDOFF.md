# HANDOFF (t_a2f35f0a, LCP: seeded Lighthouse perf 78 -> 90)

Branch perf/lcp-90 from main be7df52. Not pushed. Code tip 7d1f264 (gate + e2e were run there); this file and the
CODEMAP line are committed on top. Logs, reports, commit list, diff: _orchestrator/lcp90-indoquake/.

## LCP element and main-thread cost (Lighthouse 13.6.0 npm, mobile preset, median of 3)
| | Before: host seeded be7df52 (Rocky) | After: sandbox seed-like 7d1f264 |
|---|---|---|
| Performance / a11y / BP / SEO | 78 / 100 / 96 / 100 | 95 / 100 / 96 / 100 (runs 95, 95, 95) |
| LCP / FCP | 4807 ms / ~1.0 s | 2819 ms / 762 ms |
| TBT / CLS | 240 ms / 0.045 | 119 ms / 0.016 |
| LCP element | OSM tile `img.leaflet-tile` (3/6/3), only after the Leaflet chunk; not in the HTML, load delay 367 ms | same tile as a CSS background of the map poster, in the first HTML; load delay ~37 ms |
| Main thread | 2.3 s (script eval 983 ms, top chunk 06jx 814 ms) | 1.9 s (script eval 759 ms, 06jx 484 ms) |
Before no-DB (be7df52, this sandbox, 1 run): perf 83, LCP 4.6 s, TBT 100 ms, CLS 0.002 (merge card median: 83).
Seed-like = no Docker here, so a proxy answers /api/v1 from the e2e fixtures expanded to 100 events and passes the
rest to `next start`; the home list renders in the browser instead of SSR. Rocky: re-run the real seeded recipe on host.
BP 96 is unchanged from before: image-size-responsive on 256 px OSM tiles at DPR 1.75 (pre-existing, not touched).

## What changed
- d678a1b LCP: apps/web/src/lib/map-poster.ts + components/map-poster.tsx paint the tiles Leaflet loads for the
  national view as CSS backgrounds in the first HTML (container queries pick zoom 3/4 and only tiles in view, so no
  extra tile requests); globals.css, dashboard.tsx, map-placeholder.tsx wire it in. Unit: lib/map-poster.test.ts.
  E2E E18 (apps/e2e/tests/mocked/map-poster.spec.ts) compares poster tiles and placement with real Leaflet at 390/1280.
- 47133e4 TBT: feed-panel.tsx rows are memo components; packages/regions/src/zones.ts formatZoned caches one
  Intl.DateTimeFormat per option set (was 2 per row per dashboard render).
- 7d1f264 TBT: earthquake-map.tsx builds the Leaflet map in its own task after the chunk evaluates.
- No feature or copy changes; READMEs untouched.

## How to test
- bash scripts/gate.sh   (contract, geo-budget, typecheck, lint, unit, build, public-repo): GATE PASS at 7d1f264
- npm run test:e2e   (mocked): 75 passed, 4 failed with "timeout setting up page" (sandbox process limit); those
  files re-run alone: 13/13 passed (home-live, home-mobile, map-poster, map-tiles). Rocky: re-run on host.
- Lighthouse: _orchestrator/lcp90-indoquake/lighthouse/lhrun.mjs + seeded-proxy.mjs (sandbox), or the host recipe.

## Open / fragile
- After no-DB Lighthouse not measured: Lighthouse ran out of processes/memory in the sandbox (JSON parse crash).
- LCP 2.8 s is still above B-19's 2.5 s. Next lever: preload the one LCP tile (fetchpriority=high), not done.
- The poster mirrors Leaflet's fitBounds math; if the map's bounds, min/max zoom or the column widths change,
  E18 fails and map-poster.tsx constants must follow.
