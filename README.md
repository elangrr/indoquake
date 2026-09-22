# Indoquake

Platform informasi gempa & tsunami untuk Pulau Jawa, berbasis data terbuka BMKG.

> Sumber data gempa: **BMKG** (Badan Meteorologi, Klimatologi, dan Geofisika).
> Aplikasi ini menyajikan **estimasi** (jarak, perkiraan waktu tiba guncangan, perkiraan intensitas)
> dan **bukan** pengganti informasi resmi. Untuk peringatan resmi gempa dan tsunami,
> ikuti BMKG dan pihak berwenang setempat.

## Struktur

| Path | Isi |
| --- | --- |
| `apps/web` | Next.js — UI + API + SSE |
| `apps/worker` | Pengumpul data BMKG (polling) |
| `packages/bmkg` | Klien & parser feed BMKG |
| `packages/geo` | Perhitungan geodesik & format |
| `packages/database` | Skema & migrasi (Drizzle + PostgreSQL/PostGIS) |
| `packages/shared` | Konstanta & tipe bersama |
| `docs/` | Dokumentasi |

## API

- `GET /api/v1/earthquakes` — daftar gempa (`limit`, `minMagnitude`, `felt`, `tsunami`)
- `GET /api/v1/earthquakes/[eventKey]` — detail + riwayat revisi
- `GET /api/v1/stream` — SSE realtime (`earthquake:new`, `earthquake:updated`)
- `GET /api/v1/time` — jam server (untuk sinkronisasi countdown)
- `GET /api/v1/geocode?q=` — pencarian wilayah (kecamatan/kelurahan/kota)
- `GET /api/v1/felt-locations?eventKey=` — lokasi laporan BMKG (ter-geocode, cache Redis)
- `GET /api/v1/statistics?period=&province=` — ringkasan & distribusi
- `POST/GET/DELETE /api/v1/subscriptions` — langganan notifikasi (telegram/discord)
- `POST /api/v1/subscriptions/test` — kirim notifikasi uji ke kanal
- `GET /api/v1/health` — status DB/Redis/worker

## Halaman

`/` peta live · `/riwayat` riwayat + filter · `/statistik` chart & tren · `/provinsi` dan `/provinsi/[slug]` dashboard provinsi · `/gempa/[eventKey]` detail kejadian · `/notifikasi` pengaturan notifikasi

## Notifikasi (opsional)

- **Browser**: aktifkan di `/notifikasi` (tanpa konfigurasi server), lalu klik **"Kirim notifikasi uji"**.
- **Discord**: tempel URL webhook lewat form di `/notifikasi`, lalu klik **"Kirim notifikasi uji"** — pesan contoh langsung dikirim ke kanal Discord.
- **Telegram**: isi `TELEGRAM_BOT_TOKEN` di `.env` → jalankan `npm run env:sync` → restart `npm run dev` (dan worker). Lalu uji dengan tombol yang sama.

Tombol uji mengirim **pesan contoh (bukan gempa nyata)** sehingga kanal bisa divalidasi tanpa menunggu gempa. Endpoint: `POST /api/v1/subscriptions/test` (rate limit 5 permintaan/menit).

## Menjalankan (dev)

```bash
npm install
npm run env:sync     # salin .env -> apps/web/.env.local (Next hanya baca env dari folder project)
npm run db:migrate   # sekali saja; butuh SSH tunnel + .env terisi
npm run dev          # web (localhost:3000)
npm run dev:worker   # worker pengumpul data (polling 30 dtk)
npm test
npm run typecheck
npm run lint
npm run db:check     # cek tabel & jumlah gempa di DB
npm run build:coastline  # (opsional) perbarui dataset garis pantai Jawa
npm run build:provinces  # (opsional) perbarui dataset batas provinsi
```

Dev membutuhkan SSH tunnel ke database di VPS — lihat `docs/VPS_SETUP.md`.
