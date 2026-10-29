# HANDOFF (t_d7654b4d, R133 leftovers)

Branch fix/r133-leftovers from main ec799c4. Not pushed. Code tip 4acdf03 (checks were run there); this file is committed on top.

## What changed
- (1) 404: root app/loading.tsx was already removed on main (e7a431f), so /gempa/<bad> already answered 404.
  Now tested: mocked E11 asserts 404 + Indonesian copy for /gempa/bukan-kunci; full F5 asserts 200 for a seeded
  key and 404 for an unknown well-formed key (apps/e2e/tests/mocked/pages.spec.ts, tests/full/stack.spec.ts).
- (2) Mobile home (apps/web/src/components/dashboard.tsx): DOM/visual order is latest quake, map, list. Desktop is
  a 2-row grid (latest + list left, map sticky right across both rows), same look as before.
  latest-quake.tsx: loading skeleton (list still coming from the API) with the filled state's line heights.
  feed-panel.tsx: the first selection (null to newest quake after the API load) no longer scrolls the page;
  that scroll made CLS flaky at 1.0 once the list sat below the map. E16 (tests/mocked/home-mobile.spec.ts,
  390x844): map starts on the first screen above the list, scrollY stays 0, CLS <= 0.05 (measured ~0.002-0.017).
  Map above the full list was chosen over a short list or a toggle: no new controls or copy.
- (3) Tiles: code already did Carto only with NEXT_PUBLIC_CARTO_API_KEY, else tile.openstreetmap.org. Documented
  which and why in docs/DATA_SOURCES.md (OSMF tile policy conditions, the heavy-use limit, options weighed).
  E17 (tests/mocked/map-tiles.spec.ts) checks tiles come only from tile.openstreetmap.org and the attribution link.
- (4) apps/e2e/scripts/web-server.mjs: spawns npm start detached (own process group), stop() SIGTERMs the group,
  then SIGKILL, waits for the port to close; a process "exit" hook kills the group on throw/process.exit; refuses
  a port that already answers. run-full.mjs and serve.mjs use it and stop on SIGINT/SIGTERM. Root cause: killing
  the npm pid left sh + next-server holding the port. Tests: apps/e2e/scripts/web-server.test.mjs (npm test).
- (5) Copy unchanged and Indonesian. docs/design/CODEMAP.md updated. Mobile README shots regenerated.

## How to test
- npm run typecheck && npm run lint && npm test
- npm run build && npm run test:e2e        (mocked project; starts its own server on 3417)
- npx vitest run --dir scripts              (in apps/e2e; run twice to check ports are freed)
- Full project needs Docker: npm run e2e:full -w @indoquake/e2e (prints SKIP without Docker).

## Open / fragile
- No Docker in the sandbox: full F5 (200/404 against a seeded DB) and run-full/serve with a real stack were NOT
  run; both scripts print SKIP. The helper was run twice against real `next start` on 3419 and 3472 (stop and
  crash paths): port closed and 0 next-server processes after each.
- serve.mjs now exits 1 (was 0) when the web server dies on its own.
- The header data-status text changes width after load (small shift, pre-existing, not touched).
