# Sumber data Indoquake

## BMKG

Sumber resmi: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika), https://data.bmkg.go.id/gempabumi/.
Ketentuan: BMKG wajib dicantumkan sebagai sumber dan ditampilkan di aplikasi; batas akses 60 permintaan per menit
per IP.

| Feed | URL | Isi | Poll |
| --- | --- | --- | --- |
| autogempa | https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json | Gempa terakhir, semua magnitudo (1) | 10 s |
| gempaterkini | https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json | 15 gempa M5+ terakhir | 20 s |
| gempadirasakan | https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json | 15 gempa dirasakan terakhir (MMI) | 30 s |

- Total nominal 11 permintaan per menit; worker membatasi diri 30 per menit termasuk yang gagal. Tidak ada retry di
  dalam satu siklus; jadwal berikutnya adalah retry. Timeout 8 s. Backoff per feed min(dasar x 2^n, 120 s) +-20%,
  Retry-After dihormati (maks. 300 s). Feed dianggap down setelah 3 kegagalan beruntun.
- Shakemap: https://static.bmkg.go.id/[kode].jpg.
- Field: `DateTime` (ISO 8601 UTC, sumber kebenaran waktu), `Tanggal`/`Jam` (WIB, hanya teks cadangan; selisih
  > 2 s dicatat sebagai `time_mismatch`), `Coordinates` ("lat,lon"; bila tidak ada dipakai `Lintang`/`Bujur`, misalnya
  "7.22 LS", "107.62 BT"), `Magnitude` (-2 sampai 10), `Kedalaman` (0 sampai 1000 km), `Wilayah`, `Potensi`,
  `Dirasakan`, `Shakemap`. Item yang gagal validasi dilewati dan dicatat (`bmkg_item_skipped`).
- Feed tidak punya ID kejadian. Parameter awal dapat berubah beberapa menit setelah kejadian; Indoquake mencocokkan
  rekaman dengan selisih waktu ≤ 60 s dan jarak ≤ 50 km ke baris yang sama dan menyimpan perubahan sebagai revisi.
- Status tsunami hanya dari `Potensi` BMKG. Aplikasi tidak pernah menyatakan tsunami sendiri.

## Hasil pemeriksaan (28-10-2026, satu permintaan per cek)

- autogempa.json menjawab dengan `ETag` (weak), `Last-Modified` dan `Cache-Control: max-age=60` lewat Cloudflare.
  `If-None-Match` dengan ETag itu dijawab 304. Worker mengirim validator bila ada dan tetap bekerja tanpa validator.
- Karena cache CDN 60 s, gempa baru bisa terlambat sampai sekitar 1 menit dari sisi BMKG walaupun poll 10 s.
- Jenis data "Berpotensi Tsunami" di halaman BMKG: BELUM DIKONFIRMASI sebagai file terpisah. Tiga file di atas adalah
  yang terdaftar; tidak ada adapter baru.
- Feed realtime (200 kejadian terakhir di bmkg.go.id): endpoint JSON BELUM DIKONFIRMASI, tidak dibangun.

## Sumber lain

| Sumber | Kegunaan |
| --- | --- |
| Batas administrasi provinsi Jawa (dataset lokal, packages/regions) | Kolom `province_slug` saat ingest |
| Garis pantai (Natural Earth 10m, dataset lokal) | Estimasi jarak ke pantai |
| Ubin peta OpenStreetMap (CARTO hanya dengan kunci) | Peta dasar di browser, lihat di bawah |

## Ubin peta

- Bawaan: ubin standar OpenStreetMap dari `tile.openstreetmap.org`. Atribusi "© OpenStreetMap contributors" selalu
  tampil di pojok kanan bawah peta (kontrol atribusi Leaflet) dan menaut ke https://www.openstreetmap.org/copyright.
- Alasan: Kebijakan Penggunaan Ubin OSMF (https://operations.osmfoundation.org/policies/tiles/) mengizinkan situs web
  memakai ubin ini tanpa kunci selama atribusi terlihat, browser mengirim Referer yang sah, tidak ada unduhan massal
  atau prefetch, dan cache HTTP dihormati. Indoquake memenuhi itu: ubin hanya diminta oleh browser pengguna untuk
  bagian peta yang dilihat, server tidak pernah mengambil ubin, dan `Referrer-Policy: strict-origin-when-cross-origin`
  (next.config.ts) tetap mengirim origin situs. Data peta OSM berlisensi ODbL.
- Batas: kebijakan yang sama melarang pemakaian berat, dan OSMF boleh memblokir tanpa pemberitahuan. Bila lalu lintas
  besar (misalnya setelah gempa kuat), isi `NEXT_PUBLIC_CARTO_API_KEY` saat build atau pakai server ubin sendiri.
- CARTO hanya dipakai bila `NEXT_PUBLIC_CARTO_API_KEY` diisi saat build; tanpa kunci CARTO hanya menampilkan ubin
  "API key required". Dengan kunci, atribusinya "© OpenStreetMap contributors © CARTO".
- Pilihan lain yang ditimbang: OpenFreeMap (tanpa kunci, tetapi hanya ubin vektor sehingga butuh MapLibre GL dan
  bundel jauh lebih besar), Stadia Maps (butuh akun dan kunci untuk domain publik), ubin HOT dari OSM France
  (kapasitas donasi lebih kecil dengan kebijakan serupa).

## Aturan penyajian

1. Data resmi BMKG berlabel RESMI BMKG.
2. Perhitungan aplikasi (jarak, ETA, estimasi MMI) berlabel ESTIMASI; bukan prediksi dan bukan peringatan resmi.
3. Untuk peringatan resmi gempa dan tsunami, ikuti BMKG dan pihak berwenang setempat.
