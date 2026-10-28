# Indoquake

Status gempa bumi dan tsunami terkini untuk Pulau Jawa dari data terbuka BMKG. Worker mengambil tiga feed BMKG, menyimpan setiap kejadian, dan aplikasi web menampilkan gempa baru dalam sekitar 15 detik lewat Server-Sent Events, dengan waktu "diperbarui" yang jujur dan banner ketika data BMKG berhenti masuk. Antarmuka berbahasa Indonesia.

Situs: https://indoquake.indonode.net

English: [README.md](README.md)

## Tangkapan layar

| Desktop | Ponsel |
| --- | --- |
| ![Beranda, tema terang, 1366 px](docs/screenshots/home-desktop-light.png) | ![Beranda, tema terang, 390 px](docs/screenshots/home-mobile-light.png) |
| ![Beranda, tema gelap, 1366 px](docs/screenshots/home-desktop-dark.png) | ![Beranda, tema gelap, 390 px](docs/screenshots/home-mobile-dark.png) |
| ![Riwayat dengan saringan](docs/screenshots/riwayat-desktop-light.png) | ![Statistik, tema gelap](docs/screenshots/statistik-mobile-dark.png) |

## Arsitektur

```
Data terbuka BMKG (3 feed JSON)
        |  per feed: autogempa 10 dtk, gempaterkini 20 dtk, gempadirasakan 30 dtk
        v
apps/worker  -- dedup (60 dtk / 50 km), gabung, revisi --> PostgreSQL (earthquakes, event_log)
        |                                                      |
        +-- Redis publish (indoquake:events) + heartbeat --+   |
                                                           v   v
apps/web (Next.js)  /api/v1/* JSON  +  /api/v1/stream (SSE: ready, status, ping, earthquake, resync)
        |
        v
Browser: daftar dan peta langsung, indikator status (Langsung / Tertunda / Terputus), riwayat, statistik
```

- `apps/web`: Next.js app router. Halaman: `/`, `/riwayat`, `/statistik`, `/provinsi`, `/provinsi/[slug]`, `/gempa/[eventKey]`, `/notifikasi`. Catatan desain di [docs/design/README.md](docs/design/README.md).
- `apps/worker`: pengambil data BMKG, penyimpanan, outbox kejadian, notifikasi.
- `apps/e2e`: tes Playwright (proyek `mocked`, `full`, `shots`).
- `packages/*`: parsing BMKG, skema dan migrasi database, hitungan gempa (ETA, MMI, statistik), wilayah, status tsunami, notifikasi, tipe kontrak bersama.

## Sumber data dan ketentuan BMKG

Semua parameter gempa berasal dari BMKG (Badan Meteorologi, Klimatologi, dan Geofisika) lewat https://data.bmkg.go.id/gempabumi/. BMKG meminta paling banyak 60 permintaan per menit per IP dan BMKG disebut sebagai sumber di aplikasi. Indoquake mengirim sekitar 11 permintaan per menit (batas keras 30) dan menampilkan atribusi di setiap halaman. Peta dasar: kontributor OpenStreetMap dan CARTO.

Status tsunami hanya diambil dari kolom `Potensi` BMKG. Indoquake tidak pernah menyatakan tsunami sendiri. Jarak, waktu tiba dan intensitas di beranda adalah perkiraan dan ditandai ESTIMASI.

## API

Semua respons berupa JSON dengan `Cache-Control: no-store`; galat berbentuk `{ "error": "<teks singkat>" }`.

| Metode | Path | Catatan |
| --- | --- | --- |
| GET | `/api/v1/earthquakes` | `limit` (1 sampai 500), `page`, `minMagnitude`, `maxMagnitude`, `minDepthKm`, `maxDepthKm`, `from`, `to` (ISO 8601), `felt=true`, `tsunami=true`, `province=<slug>`, `q` (2 sampai 60 karakter), `order=desc` atau `asc` |
| GET | `/api/v1/earthquakes/[eventKey]` | detail dengan feed dan revisi (terbaru dulu); kunci tidak dikenal: 404 |
| GET | `/api/v1/statistics` | `period=24h`, `7d`, `30d`, `1y` atau `all`; `province=<slug>` |
| GET | `/api/v1/health` | database, Redis, heartbeat worker dan kesegaran data (`fresh`, `stale`, `down`, `unknown`) |
| GET | `/api/v1/time`, `/api/v1/geocode`, `/api/v1/felt-locations` | waktu server, geocoding balik, lokasi laporan dirasakan |
| POST, GET, DELETE | `/api/v1/subscriptions` | notifikasi Telegram atau Discord; 10 per jam per IP |
| POST | `/api/v1/subscriptions/test` | mengirim pesan contoh; 5 per menit per IP |
| GET | `/api/v1/stream` | Server-Sent Events: `ready`, `status`, `ping` tiap 15 dtk, `earthquake` dengan `id`, `resync`; sambung ulang dengan `Last-Event-ID` |

## Menjalankan, tes dan deploy

```bash
npm install
npm run dev                          # web di http://localhost:3000 (butuh DATABASE_URL, REDIS_URL)
npm run dev:worker                   # pengambil data BMKG
npm run typecheck
npm run lint
npm test                             # tes unit, tanpa browser
npm run build
npm run e2e -w @indoquake/e2e        # Playwright, API tiruan, tanpa database
npm run e2e:full -w @indoquake/e2e   # PostGIS dan Redis asli lewat Testcontainers (Docker)
npm run e2e:shots -w @indoquake/e2e  # membuat ulang docs/screenshots
```

Produksi berjalan di satu host dengan Docker Compose (web, worker, PostgreSQL dengan PostGIS, Redis) di belakang nginx dan certbot: `docker compose -f deploy/compose.prod.yml --env-file .env up -d --build`. Prosedur lengkap, tanpa detail host, ada di `docs/DEPLOY.md`.

## Keselamatan

Situs ini menyajikan estimasi informasi dan bukan pengganti informasi darurat resmi. Untuk peringatan resmi gempa dan tsunami, ikuti BMKG dan pihak berwenang setempat.
