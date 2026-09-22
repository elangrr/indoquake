# Arsitektur — Indoquake

## Alur data

```
BMKG (autogempa, gempaterkini, gempadirasakan, Shakemap JPG)
  │  polling 30 detik dari server (~6 req/menit, batas 60/menit)
  ▼
apps/worker  →  fetch → validasi → normalisasi → dedup/revisi → simpan
  ▼
PostgreSQL + PostGIS (VPS, via SSH tunnel saat dev)
  ▼
apps/web: UI + REST /api/v1 + SSE /api/v1/stream
  ▼
Frontend (Leaflet + ECharts) — Bahasa Indonesia
```

## Tanggung jawab paket

| Paket | Isi |
| --- | --- |
| `packages/shared` | URL feed BMKG, teks atribusi & disclaimer, konstanta |
| `packages/bmkg` | Klien HTTP, parser 3 feed, dedup `eventKey`, tipe |
| `packages/geo` | Haversine, jarak hiposentral, format durasi/jarak (id-ID) |
| `packages/earthquake` | Model kecepatan P/S, ETA, atenuasi & skala MMI, statistik |
| `packages/tsunami` | Status tsunami resmi BMKG (aturan: aplikasi tidak pernah mendeklarasikan tsunami) |
| `packages/regions` | Data batas provinsi (geoBoundaries) + resolver point-in-polygon |
| `packages/notifications` | Pencocokan langganan + format pesan notifikasi |
| `packages/database` | Skema Drizzle (earthquakes, earthquake_feeds, earthquake_updates, alert_subscriptions), migrasi |
| `apps/worker` | Polling, penyimpanan, broadcast (Fase 1+) |
| `apps/web` | Halaman, API, SSE (Fase 2+) |

## Prinsip

1. **Tiga label data**: RESMI BMKG / ESTIMASI (hitung aplikasi) / INPUT PENGGUNA (GPS).
2. Tidak memprediksi gempa; ETA = estimasi + rentang; tidak pernah "0 detik".
3. Status tsunami hanya dari BMKG/InaTEWS.
4. GPS hanya dipakai di sesi pengguna; tidak disimpan server tanpa opt-in.
5. Atribusi BMKG wajib tampil (footer + `/tentang/data`).

## Status fase

- [x] Fase 0 — Fondasi: repo, packages, DB VPS, parser BMKG + fixture test
- [x] Fase 1 — Ingestion: worker polling 30 dtk (retry/backoff), dedup + revisi (kebijakan merge per-field), heartbeat Redis, `/api/v1/health`
- [x] Fase 2 — Peta live (Leaflet + Carto Dark raster, pulse gempa terbaru, shockwave episenter), panel feed + filter, SSE realtime (`/api/v1/stream`), halaman detail `/gempa/[eventKey]`
- [x] Fase 3 — GPS (opt-in, sessionStorage saja) + **input lokasi manual** (koordinat / preset 10 kota Jawa), jarak episentral & hiposentral (haversine WGS84, berlabel ESTIMASI), filter radius "Di Sekitar Saya" (25–500 km), marker lokasi + lingkaran akurasi/radius di peta
- [x] Fase 4 — ETA (`@indoquake/earthquake`: model kecepatan P/S configurable + ketidakpastian), countdown sinkron jam server (`/api/v1/time`), blind zone, **Event Replay** (animasi rambat gelombang P/S + status per lokasi)
- [x] Fase 5 — Estimasi **MMI** (model atenuasi magnitudo–jarak, configurable) di lokasi pengguna + skala MMI Indonesia, pemisahan tegas dari **laporan resmi BMKG (Dirasakan)** yang kini terstruktur; pencarian wilayah detail (kecamatan/kelurahan) via `/api/v1/geocode`
- [x] Fase 5 lanjutan — **peta MMI observasi**: nama tempat laporan BMKG di-geocode (Nominatim, dibatasi viewbox sekitar episenter agar tidak ambigu) + cache Redis; marker berwarna per MMI di peta
- [x] Fase 5 lanjutan — **animasi shockwave** di episenter: radius batas terasa dari data BMKG (jarak maksimum laporan ter-geocode) atau dari model MMI (diselesaikan numerik untuk MMI ≈ II)
- [x] Fase 6 — **Tsunami**: status resmi BMKG (`@indoquake/tsunami`), panel status + banner peringatan, jarak lokasi ke pantai (Natural Earth 10m dipotong ke Jawa), tautan InaTEWS
- [x] Fase 7 — **Analitik**: penentuan provinsi (geoBoundaries point-in-polygon + fallback terdekat), modul statistik (`packages/earthquake/statistics`), `/api/v1/statistics`, halaman `/riwayat` (filter + paginasi), `/statistik` (kartu ringkasan + 6 chart ECharts + timeline bulanan), `/provinsi` + `/provinsi/[slug]`, navigasi header
- [x] Fase 8 — **Notifikasi**: paket `@indoquake/notifications` + `@indoquake/regions`, tabel `alert_subscriptions`, worker mengirim ke Telegram (Bot API) / Discord (webhook) untuk gempa baru yang cocok, API `/api/v1/subscriptions`, halaman `/notifikasi` (notifikasi browser + form langganan)
- [ ] Fase 7 lanjutan — heatmap aktivitas di peta utama (frekuensi / bobot magnitudo)
- [ ] Fase 8 lanjutan — perintah bot Telegram (/terbaru, /hariini, /kuat, /tsunami) & kanal email
- [ ] Fase 9–10 — API publik + admin, produksi (PWA, SEO, Docker)

## API publik (Fase 2)

| Endpoint | Isi |
| --- | --- |
| `GET /api/v1/earthquakes?limit=&minMagnitude=&felt=true&tsunami=true` | Daftar gempa (urut waktu terbaru) |
| `GET /api/v1/earthquakes/[eventKey]` | Detail + feed asal + riwayat revisi |
| `GET /api/v1/stream` | SSE: `earthquake:new` / `earthquake:updated` |
| `GET /api/v1/time` | Jam server (sinkronisasi countdown) |
| `GET /api/v1/geocode?q=` | Pencarian wilayah Indonesia (proxy Nominatim + cache 24 jam + rate limit 1 req/dtk) |
| `GET /api/v1/felt-locations?eventKey=` | Lokasi laporan BMKG yang sudah di-geocode (cache Redis; sisanya diproses di latar belakang) |
| `GET /api/v1/statistics?period=&province=` | Ringkasan + distribusi + tren harian/jam/provinsi |
| `POST /api/v1/subscriptions` | Buat/perbarui langganan notifikasi (telegram/discord) |
| `POST /api/v1/subscriptions/test` | Kirim notifikasi UJI ke kanal (validasi token/webhook; rate limit 5/menit) |
| `GET /api/v1/subscriptions?target=` | Status langganan berdasarkan target |
| `DELETE /api/v1/subscriptions?id=&target=` | Nonaktifkan langganan (target harus cocok) |
| `GET /api/v1/health` | Status DB, Redis, worker |

## Catatan operasional (dev)

- Env: root `.env` adalah sumber utama; `npm run env:sync` menyalinnya ke `apps/web/.env.local` (Next.js hanya membaca `.env*` dari folder project).
- Worker: `npm run dev:worker` (loop 30 dtk) atau `npm run start -w @indoquake/worker -- --once` (satu siklus).
- Kebijakan merge lintas-feed: numerik selalu diterapkan; `regionName`/`potentialText` sticky (first writer wins); `feltText`/`shakemapUrl`/`tsunamiPotential` diterapkan bila non-null — mencegah saling timpa antar feed.
- Privasi GPS: lokasi hanya dihitung di perangkat pengguna dan disimpan di `sessionStorage` (hilang saat tab ditutup). Tidak pernah dikirim/diisimpan ke server. Akurasi rendah (`enableHighAccuracy: false`) dipakai karena jarak gempa berskala km.
- Lokasi manual: koordinat bebas atau preset kota, disimpan sama seperti GPS (sessionStorage) dan ditandai `input pengguna`.
- ETA: model kecepatan kerak konstan (P 6.1 km/s, S 3.5 km/s, ketidakpastian ±25%) di `packages/earthquake` — dapat dikonfigurasi. Countdown memakai offset jam server (koreksi RTT), bukan jam lokal. Blind zone bila hiposentral ≤ 25 km atau sisa waktu ≤ 5 dtk.
- MMI: estimasi memakai model atenuasi sederhana `MMI = 1.0 + 1.2·M − 2.0·log10(R)` (configurable di `packages/earthquake/src/mmi.ts`), selalu berlabel ESTIMASI. Laporan `Dirasakan` BMKG diparse menjadi daftar `{ mmi, place }` (server-side) dan ditampilkan terpisah dengan label RESMI BMKG — tidak pernah dicampur.
- Geocoding nama tempat BMKG: prefix admin (`Kab.`/`Kota`/`Kec.`) dinormalisasi, pencarian dibatasi `viewbox` ±3° di sekitar episenter (`bounded=1`) agar nama ambigu (mis. "Manggarai") resolve ke wilayah yang benar; hasil di-cache di Redis (hit 30 hari, miss 7 hari) dan resolusi dijalankan di latar belakang agar respons API tetap cepat. Posisi bersifat **perkiraan** (berbasis nama tempat, bukan koordinat resmi BMKG).
- Tsunami: aplikasi **tidak pernah** mendeklarasikan tsunami. Status hanya diturunkan dari field resmi BMKG `Potensi` (`Berpotensi tsunami` / `Tidak berpotensi tsunami`); InaTEWS ditautkan sebagai rujukan resmi. Jarak ke pantai dihitung dari dataset `apps/web/src/data/java-coastline.json` (Natural Earth 10m, dipotong bbox Jawa + Bali, 1.829 titik, 34 KB) — perbarui dengan `npm run build:coastline`.
- Shockwave episenter: radius = jarak maksimum laporan BMKG ter-geocode bila tersedia (data), jika tidak dari model MMI dengan ambang II (kalkulasi). Animasi 3 cincin berulang (2,6 dtk) + lingkaran batas putus-putus; disembunyikan saat Event Replay aktif.
- Provinsi: dataset `apps/web/src/data/java-provinces.json` (geoBoundaries IDN ADM1 simplified, dipotong ke 6 provinsi Jawa + Bali, CC BY 4.0) — perbarui dengan `npm run build:provinces`. Penentuan: point-in-polygon (dengan pre-filter bbox) lalu fallback provinsi terdekat ≤ 250 km untuk gempa lepas pantai; di luar itu `provinceSlug = null`.
- Statistik: agregasi murni di `packages/earthquake/src/statistics.ts` (diuji unit). Hari/jam memakai WIB (+7 jam). Halaman `/statistik` memakai ECharts (import dinamis, hanya di klien).
- Notifikasi: hanya untuk kejadian **baru** (bukan revisi). Pencocokan langganan (magnitudo, radius dari lokasi langganan, provinsi, dirasakan, potensi tsunami) di `packages/notifications` dan diuji unit. Kanal: Telegram (butuh `TELEGRAM_BOT_TOKEN`), Discord (webhook), browser (client-side, pengaturan di localStorage). Setiap pesan selalu mencantumkan sumber BMKG + penegasan "bukan peringatan resmi".
