# Indoquake web design notes

Purpose: show the newest quakes on Java and whether BMKG data is current, fast enough to read on a phone in the first seconds after shaking.
Audience: residents of Java on phones (390 px first), plus people checking history and statistics on desktop.
Direction: seismograph field station. Paper and graphite surfaces, thin rules instead of boxes, one signal colour, monospaced tabular figures for every number.
Differentiator: the 24 hour seismogram strip under the latest quake, one spike per real event, height by magnitude.

## Tokens (apps/web/src/app/globals.css)

| Role | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--bg` | `#eef0ee` | `#121517` | page |
| `--surface` | `#f7f8f6` | `#191d20` | header, footer, list |
| `--surface-2` | `#e2e6e2` | `#23282c` | hover, selected row, map placeholder |
| `--rule` | `#c3c9c4` | `#343b40` | 1 px rules |
| `--ink` | `#16191b` | `#e6e9e7` | text |
| `--ink-muted` | `#4f575b` | `#9ea7ac` | labels, metadata (AA on bg and surface) |
| `--signal` | `#b8380a` | `#ff7448` | active nav, selected row bar, newest spike, new quake pulse |
| `--danger` | `#a3171b` | `#ff8b84` | tsunami, down banner, errors |
| `--warn` / `--ok` | `#7d5300` / `#2d6a39` | `#e8b64c` / `#82cc8f` | status dot |
| `--focus` | `#0f4f8a` | `#7cc0ff` | 2 px focus outline (3:1 or more on every surface) |

Values use CSS `light-dark()`: the theme follows `prefers-color-scheme`, and the header toggle sets `data-theme` on `<html>` (stored in localStorage, applied by an inline script before first paint).

Magnitude ramp (map markers and the tick next to every magnitude): `#7f8e8a` below 3, `#c9a227` 3+, `#e07b26` 4+, `#d9481c` 5+, `#a31616` 6+. The number is always printed next to the colour.

## Type

- Text: Archivo (variable, self-hosted from fontsource via `next/font/local`, Arial fallback with size adjust).
- Figures: Martian Mono (variable) for magnitudes, times, counts, coordinates (`.num`).
- Scale 1.25 on 16 px: 12, 14, 16, 20, 24, 36 (Tailwind `xs`, `sm`, `base`, `xl`, `2xl`, `4xl`). No text below 12 px.
- Sentence case. Times always in WIB with the label, formatted from UTC with `Intl` id-ID.

## Layout

- Phone first: latest quake, list, then map. From 1024 px: list column (28 rem) and a sticky map.
- Document scroll everywhere; only the map has a fixed height.
- Navigation: inline from 640 px, bottom bar below. Every target is at least 44 by 44 px.
- No cards inside cards: sections are separated by rules.

## Motion

- New quake: list row and map marker pulse 3 times over 6 s, then stop.
- Selected quake: 1 to 4 intensity rings by magnitude class (below 4, 4 to 5, 5 to 6, 6 and up), 2 runs.
- Map flyTo 600 ms. Hover colour changes 150 ms. No infinite animation, no bounce, no `transition: all`.
- `prefers-reduced-motion: reduce` turns all CSS animation off and makes the map jump without animation.

## Performance

- The map (Leaflet, leaflet.css) and charts (ECharts) are dynamic imports; the map mounts after idle behind a placeholder.
- The LCP element is the latest quake text. `apps/web/scripts/check-bundle.mjs` checks the home First Load JS (budget 180 kB gzip) and that Leaflet and ECharts stay out of the home entry.
