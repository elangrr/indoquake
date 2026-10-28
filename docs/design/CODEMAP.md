# apps/web and apps/e2e code map (lane B)

- apps/web/src/app/layout.tsx: shell (fonts, theme init script, skip link, LiveProvider, header, footer).
- apps/web/src/app/page.tsx: home; SSR list via lib/queries, falls back to the API in the browser.
- apps/web/src/app/{riwayat,statistik,provinsi}/: static shells; data fetched by components/*-view.tsx through /api/v1.
- apps/web/src/app/gempa/[eventKey]/page.tsx: server-rendered detail, one cached read (lib/detail.ts).
- apps/web/src/components/live-provider.tsx: one SSE connection per tab (lib/live-feed.ts), freshness state, listeners.
- apps/web/src/components/dashboard.tsx: home state (merge, pulse, toasts, announcer), lazy map (earthquake-map.tsx).
- apps/web/src/components/data-status.tsx, data-banner.tsx: header status and the down banner (lib/data-status.ts).
- apps/web/src/lib/merge-event.ts: field-wise merge of stream frames into the list.
- apps/web/src/lib/history-query.ts: /riwayat URL params to API params; lib/wib.ts: WIB formatting and day bounds.
- apps/web/src/lib/use-api.ts: keyed GET hook with loading, error, retry.
- apps/web/scripts/check-bundle.mjs: home bundle budget; scripts/sync-fonts.mjs: copies fontsource woff2 into src/lib/fonts.
- apps/e2e/support/: fixtures, API mock and EventSource stub; scripts/stack.mjs: Testcontainers stack, migrate, seed.
- apps/e2e/tests/{mocked,full,shots}/: Playwright projects (mocked runs anywhere, full needs Docker, shots writes docs/screenshots).
