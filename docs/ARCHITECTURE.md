# Arsitektur Indoquake

## Alur data

```
BMKG (autogempa 10 s, gempaterkini 20 s, gempadirasakan 30 s; maks. 30 permintaan/menit dari worker)
  │  GET bersyarat (If-None-Match / If-Modified-Since), 304 = sukses tanpa parse
  ▼
apps/worker   scheduler per feed → validasi → dedup (≤ 60 s dan ≤ 50 km) → upsert dalam 1 transaksi
  │           + baris event_log (outbox) di transaksi yang sama → publish Redis setelah commit
  ▼
PostgreSQL (image PostGIS)            Redis: kanal indoquake:events + heartbeat worker (TTL 900 s)
  ▼                                     ▼
apps/web  REST /api/v1 + SSE /api/v1/stream (replay dari event_log, Redis hanya sinyal bangun)
  ▼
Browser (Bahasa Indonesia)
```

## Paket

| Paket | Isi | File masuk |
| --- | --- | --- |
| packages/shared | Kontrak bersama (tipe, konstanta). Disalin byte demi byte, tidak diedit | src/types.ts, src/constants.ts |
| packages/bmkg | Klien feed (GET bersyarat, Retry-After), parser dengan validasi dan alasan skip, dedup | src/index.ts |
| packages/database | Skema Drizzle, migrasi, migrator dengan advisory lock, serializer baris ke kontrak | src/index.ts, src/migrate.ts |
| packages/api | Query list/detail/statistik, freshness, health, rate limit, hub SSE (tanpa framework) | src/index.ts |
| packages/earthquake | Statistik, MMI, waktu tiba gelombang | src/index.ts |
| packages/geo, tsunami, notifications | Jarak, status tsunami, format dan kirim notifikasi | src/index.ts |
| packages/regions | 38 provinsi, zona WIB/WITA/WIT, assignArea (provinsi atau Laut/Perairan); `./meta` aman untuk browser | src/index.ts, src/meta.ts |
| apps/worker | Poller BMKG, penentuan wilayah saat simpan, backfill wilayah, retensi, leader lock, bot Telegram | src/index.ts |
| apps/web | Next.js; route API adalah pembungkus tipis atas packages/api | src/app/api/v1 |

## Aturan data

- `eventKey` dibuat dari sidik jari pertama kali terlihat dan tidak pernah berubah; revisi BMKG (waktu, koordinat,
  magnitudo, kedalaman) disimpan sebagai revisi pada baris yang sama.
- Kebijakan field: angka dan waktu asal: nilai terbaru menang; `regionName`: penulis pertama menang; `potentialText`
  diganti bila teks baru menyatakan potensi tsunami (ya atau tidak), jadi teks tidak pernah bertentangan dengan flag;
  `tsunamiPotential`, `feltText`, `shakemapUrl`: nilai baru yang tidak null menang.
- Pengumuman menurut umur saat pertama terlihat: > 6 jam disimpan diam-diam; 30 menit sampai 6 jam hanya event_log;
  ≤ 30 menit event_log dan notifikasi. Revisi hanya dinotifikasi ulang bila flag tsunami berubah, magnitudo bergeser
  ≥ 0,5 atau melewati ambang M4,5.
- Wilayah: saat insert dan saat koordinat direvisi worker menyimpan `area_kind` (land/sea), `province_slug` (darat
  saja), `nearest_province_slug` dan `nearest_province_km` (laut saja) dan `region_version`. Baris lama
  (`region_version` di bawah versi saat ini) ditentukan ulang oleh backfill saat worker start (per 500 baris, advisory
  lock 7137001, tanpa notifikasi atau event_log; `REGION_BACKFILL=off` melewatinya). Selama backfill berjalan, baris
  lama (`area_kind` null) tetap cocok dengan `province=` lewat `province_slug` tersimpan.
- Waktu per gempa ditampilkan di zona provinsinya (laut: provinsi terdekat); agregat nasional, filter tanggal dan
  /hariini tetap hari WIB.
- Langganan provinsi X cocok dengan gempa darat di X dan gempa laut dengan provinsi terdekat X dalam 300 km.
- Gempa disimpan selamanya (RETENTION_DAYS=0). event_log dipangkas tiap jam setelah EVENT_LOG_RETENTION_HOURS (72).
- Status data: `lastSuccessAt` = poll autogempa sukses terakhir. fresh ≤ 90 s, stale ≤ 600 s, down setelahnya.

## API publik

Semua JSON dengan `Cache-Control: no-store`; galat berbentuk `{ "error": "<pesan singkat>" }`.

| Endpoint | Isi |
| --- | --- |
| GET /api/v1/earthquakes | Daftar dengan filter limit, page, minMagnitude, maxMagnitude, minDepthKm, maxDepthKm, from, to, felt, tsunami, province (38 slug, darat), area (land\|sea), nearProvince (laut, terdekat dalam 300 km), q, order; meta.total dan totalPages. province+nearProvince, province+area=sea dan nearProvince+area=land: 400 |
| GET /api/v1/earthquakes/[eventKey] | Detail dengan feeds dan revisi (terbaru dulu); 404 untuk key tak dikenal |
| GET /api/v1/statistics?period=24h\|7d\|30d\|1y\|all&province=&area= | Ringkasan (dengan countSea), distribusi, per hari, per jam, per provinsi (38 item: zone, count darat, seaCount laut dalam 300 km), per bulan (12 bulan WIB) |
| GET /api/v1/health | 200 selama database dan Redis menjawab; `data` berisi freshness BMKG |
| GET /api/v1/stream | SSE: retry, ready, status, earthquake (id = seq), ping tiap 15 s, resync; ditutup setelah 15 menit |
| GET /api/v1/time, /geocode, /felt-locations | Tidak berubah |
| POST/GET/DELETE /api/v1/subscriptions, POST /subscriptions/test | Batas 10/jam dan 5/menit per X-Real-IP, 200/hari total untuk uji |

IP klien untuk batas permintaan dan batas stream (SSE_MAX_PER_IP=6, SSE_MAX_CONNECTIONS=500 per proses web) hanya
dari header X-Real-IP, yang ditimpa nginx dengan `$remote_addr`. X-Forwarded-For diabaikan.

## Uji

`bash scripts/gate.sh` (typecheck, lint, unit, build, cek repo publik), `bash scripts/gate.sh --int`
(Testcontainers PostGIS dan Redis; tanpa Docker tercetak `SKIP: docker unavailable`). Lihat docs/DEPLOY.md.
