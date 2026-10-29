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
- Cakupan: semua gempa yang dimuat feed BMKG untuk seluruh Indonesia dan sekitarnya. Worker mengirim user-agent
  `Indoquake/0.2 (monitoring gempa Indonesia; sumber data BMKG)` ke ketiga feed.

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
| Batas 38 provinsi (geoBoundaries, packages/regions dan apps/web/public/geo) | Provinsi atau Laut/Perairan saat ingest, peta provinsi |
| Garis pantai nasional (Natural Earth 10m, apps/web/public/geo/garis-pantai.json) | Estimasi jarak ke pantai |
| Ubin peta OpenStreetMap (CARTO hanya dengan kunci) | Peta dasar di browser, lihat di bawah |

## Batas provinsi dan garis pantai (R137)

Dibangun ulang dengan `node scripts/build-provinces.mjs` dan `node scripts/build-coastline.mjs` (unduh sekali dengan
`--download` ke `packages/regions/data-src/raw/`, tidak di-commit). Konfigurasi: `packages/regions/data-src/build-config.json`.
Input yang sama menghasilkan byte yang sama. sha256 lengkap ada di `packages/regions/data-src/geo-inputs.SHA256SUMS`.

| Input | URL | Rilis / commit | Diunduh | Lisensi | sha256 (12) |
| --- | --- | --- | --- | --- | --- |
| geoBoundaries-IDN-ADM1_simplified.geojson | https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM1/geoBoundaries-IDN-ADM1_simplified.geojson | gbOpen commit 9469f09592ced973a3448cf66b6100b741b64c0d | 29-10-2026 | ODbL 1.0 (sumber: OpenStreetMap, Wambacher; boundaryID IDN-ADM1-65028918) | 5a6be3d14841 |
| geoBoundaries-IDN-ADM2_simplified.geojson | https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2_simplified.geojson | gbOpen commit 9469f09592ced973a3448cf66b6100b741b64c0d | 29-10-2026 | CC BY 3.0 IGO (sumber: BPS, WFP, OCHA ROAP; boundaryID IDN-ADM2-22746128) | 146653d48833 |
| ne_10m_coastline.geojson | https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_10m_coastline.geojson | Natural Earth v5.1.2, commit f1890d9f152c896d250a77557a5751a93d494776 | 29-10-2026 | public domain | 6f75ae0e0de1 |

- Vintage: ADM1 boundaryYearRepresented 2017, 34 fitur (sebelum pemekaran Papua 2022), boundaryID IDN-ADM1-65028918.
  ADM2 boundaryYearRepresented 2020, 519 fitur, boundaryID IDN-ADM2-22746128. Keduanya dari commit 9469f09 (build
  geoBoundaries 12-12-2023, metadata API geoboundaries.org/api/current/gbOpen/IDN/ADM1 dan ADM2).
- 32 provinsi diambil dari ADM1 (dicocokkan lewat kode ISO 3166-2 `shapeISO`). Papua dan Papua Barat ADM1 tidak dipakai;
  enam provinsi Papua dibangun dengan dissolve 42 fitur ADM2 (kabupaten/kota) per undang-undang 2022.
- DKI Jakarta: ADM1 hanya berisi daratan dan satu pulau kecil, jadi ring Kabupaten Kepulauan Seribu dari ADM2
  (72 ring, commit 9469f09 yang sama) ditambahkan ke dki-jakarta (`adm2Added` di build-config.json).
- Lisensi (DECISIONS D32): ADM1 IDN-ADM1-65028918 bersumber dari OpenStreetMap (Wambacher), ODbL 1.0. ADM2
  IDN-ADM2-22746128 bersumber dari BPS/WFP/OCHA, CC BY 3.0 IGO. File provinsi dan lookup yang dihasilkan
  (provinces-lookup.json, provinces-meta.json, provinsi.json, provinsi/<slug>.json) dirilis di bawah ODbL 1.0.
  Atribusi yang ditampilkan dan disimpan di setiap file hasil (konstanta `GEOBOUNDARIES_ATTRIBUTION`):
  "Batas provinsi: geoBoundaries; © OpenStreetMap contributors (ODbL); BPS/OCHA (CC BY 3.0 IGO)".

Pemetaan kabupaten/kota Papua 2022 (setiap baris dicek ke sumber pemerintah, 29-10-2026):

| Provinsi | Dasar | Kabupaten/kota (nama ADM2) | Sumber |
| --- | --- | --- | --- |
| Papua Selatan | UU 14/2022 | Merauke, Boven Digoel, Mappi, Asmat | https://jdih.kemenkoinfra.go.id/uu-142022-pembentukan-provinsi-papua-selatan ; https://peraturan.bpk.go.id/Details/217796/uu-no-14-tahun-2022 |
| Papua Tengah | UU 15/2022 | Nabire, Paniai, Mimika, Puncak Jaya, Puncak, Dogiyai, Intan Jaya, Deiyai | https://jdih.kemenkoinfra.go.id/uu-152022-pembentukan-provinsi-papua-tengah ; https://peraturan.bpk.go.id/Details/217798/uu-no-15-tahun-2022 |
| Papua Pegunungan | UU 16/2022 | Jayawijaya, Pegunungan Bintang, Yahukimo, Tolikara, Mamberamo Tengah, Yalimo, Lanny Jaya, Nduga | https://peraturan.bpk.go.id/Details/217799/uu-no-16-tahun-2022 ; https://jdih.papua.go.id/common/dokumen/uunomor16tahun2022-.pdf |
| Papua Barat Daya | UU 29/2022 | Kota Sorong, Sorong, Sorong Selatan, Raja Ampat, Tambrauw, Maybrat | https://jdih.kemenkoinfra.go.id/uu-292022-pembentukan-provinsi-papua-barat-daya ; https://peraturan.bpk.go.id/Details/232726/uu-no-29-tahun-2022 |
| Papua | sisa setelah UU 14, 15, 16/2022 | Kota Jayapura, Jayapura, Keerom, Sarmi, Mamberamo Raya, Waropen, Biak Numfor, Supiori, Kepulauan Yapen | https://bapperida.papua.go.id/file/RKPD%20Tahun%202024.pdf |
| Papua Barat | sisa setelah UU 29/2022 | Manokwari, Manokwari Selatan, Pegunungan Arfak, Teluk Bintuni, Teluk Wondama, Fakfak, Kaimana | https://papuabaratprov.go.id/home/pages?slug=kl0a_AAZBwR7BgNYu8I-igfMVfjfVH8L ; https://papuabarat.bpk.go.id/wilayah-pemeriksaan/provinsi-papua-barat/ |

Pemeriksaan generator (gagal = keluar non-zero dengan pesan): 38 provinsi; 42 fitur ADM2 berbeda; tiap provinsi Papua
punya ring; tumpang tindih antar enam provinsi Papua < 0,1% dari yang terkecil (terukur 0 km2); jumlah luas enam
provinsi dalam 2% dari ADM1 Papua + Papua Barat (terukur 414.349 vs 413.757 km2, beda 0,143%); setiap titik kota SPEC
bagian 6 ada di provinsinya sendiri dan tidak di provinsi lain.

Penyederhanaan (Douglas-Peucker per ring; setiap ring, termasuk pulau kecil, menyimpan minimal 3 titik):

| Lapisan | File | Interval | Desimal |
| --- | --- | --- | --- |
| Lookup server | packages/regions/src/data/provinces-lookup.json | 200 m | 4 |
| Tampilan nasional | apps/web/public/geo/provinsi.json | 2000 m | 3 |
| Detail per provinsi | apps/web/public/geo/provinsi/<slug>.json | 300 m | 4 |
| Garis pantai | apps/web/public/geo/garis-pantai.json | 0,005 derajat, batas INDONESIA_BOUNDS + 0,5 derajat | 4 |

- Pergeseran maksimum lapisan lookup terhadap input geoBoundaries: 0,205 km (diukur oleh generator, batas STOP 1 km).
- SNAP_KM = 2: titik di luar semua poligon tetapi dalam 2 km dari garis provinsi dihitung darat provinsi itu (snapped).
  Di luar itu Laut/Perairan dengan provinsi terdekat dan jaraknya (km bulat); label "Perairan dekat <Provinsi>" sampai
  NEAR_SEA_MAX_KM = 300.

### Display vs lookup geometry

Peta menampilkan lapisan tampilan (interval 2000 m) dan file detail (300 m), sedangkan penentuan provinsi memakai
lapisan lookup server (200 m, maksimal 500 m). Garis yang digambar bisa bergeser sampai sekitar 2 km dari garis lookup,
jadi gempa yang hanya beberapa km dari batas provinsi bisa tampak berada di garis provinsi tetangga. Penentuan provinsi
oleh server (kolom `province_slug`, `area_kind`) yang berlaku; browser tidak pernah menentukan provinsi sendiri.

### Batasan: pulau kecil yang tidak ada di ADM1

ADM1 geoBoundaries (sumber OpenStreetMap 2017) tidak memuat sebagian pulau kecil. Kepulauan Seribu sudah ditambahkan
dari ADM2 (di atas); pulau lain tidak. Probe review t_4ad96343 (sebelum penambahan Kepulauan Seribu) menemukan 371
poligon pulau kecil ADM2, sekitar 219 km2, yang berjarak lebih dari 10 km dari provinsi mana pun di lookup, misalnya
Kepulauan Balabalakang (Mamuju) dan pulau-pulau kecil Banggai Laut. Kekurangan ini ada di sumber ADM1, bukan akibat
penyederhanaan. Gempa di pulau seperti itu disimpan sebagai Laut/Perairan dengan provinsi terdekat dan jaraknya.

### Batasan: daratan negara lain

Dataset hanya berisi Indonesia. Gempa di daratan negara tetangga (misalnya Dili, Kota Kinabalu, Davao) disimpan sebagai
Laut/Perairan dengan provinsi terdekat dan jaraknya, dan zona waktu provinsi terdekat. Kelompok khusus untuk daratan
negara lain diusulkan sebagai tugas berikutnya (DECISIONS D22).

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
