# Sumber Data — Indoquake

## Sumber utama: BMKG

**BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)** adalah sumber resmi data
gempa bumi yang digunakan aplikasi ini.

> Wajib: cantumkan BMKG sebagai sumber data dan tampilkan pada aplikasi
> (ketentuan halaman resmi `data.bmkg.go.id/gempabumi/`).

### Feed yang dipakai

| Feed | URL | Isi | Jumlah |
| --- | --- | --- | --- |
| Gempabumi Terbaru | `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json` | Gempa terakhir (semua magnitudo) | 1 |
| Gempabumi M 5.0+ | `https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json` | Daftar gempa M5+ | 15 |
| Gempabumi Dirasakan | `https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json` | Daftar gempa dirasakan (MMI) | 15 |

- Format alternatif: XML (`.xml`) dengan skema sama.
- Shakemap (JPG): `https://static.bmkg.go.id/[kode_shakemap].jpg`
- Pemutakhiran: setiap ada kejadian.
- **Batas akses: 60 permintaan/menit/IP** — aplikasi hanya polling dari server
  (~6 permintaan/menit) dan tidak pernah fetch langsung dari browser pengunjung.
- Parser referensi resmi: `github.com/infoBMKG/data-gempabumi`

### Field feed

`Tanggal`, `Jam` (WIB), `DateTime` (ISO 8601 UTC), `Coordinates` (lintang,bujur),
`Lintang`, `Bujur`, `Magnitude`, `Kedalaman` (km), `Wilayah`, `Potensi`
(status tsunami & catatan dirasakan), `Dirasakan` (laporan MMI), `Shakemap`.

### Catatan penting

- Feed **tidak menyediakan ID kejadian** — Indoquake membuat `eventKey` sendiri
  (hash dari waktu UTC + koordinat dibulatkan 2 desimal).
- Parameter awal dapat **berubah** beberapa menit setelah kejadian sampai
  ditinjau seismolog (pernyataan resmi InaTEWS). Perubahan disimpan sebagai
  revisi dan ditandai di UI.

## Sumber pendukung

| Sumber | Kegunaan | Status |
| --- | --- | --- |
| InaTEWS (`inatews.bmkg.go.id`) | Status tsunami resmi | Fase 6 (spike) |
| Repogempa (`repogempa.bmkg.go.id`) | Backfill katalog historis | Opsional, Fase 7 |
| Batas administrasi provinsi | Deteksi provinsi | Fase 0 (dataset lokal) |
| Garis pantai (Natural Earth 10m) | Jarak ke pantai (estimasi) | Fase 6 |

## Aturan penyajian

1. Data resmi BMKG selalu berlabel **RESMI BMKG**.
2. Perhitungan aplikasi (jarak, ETA, estimasi MMI) selalu berlabel **ESTIMASI**
   dengan rentang ketidakpastian — bukan prediksi, bukan peringatan resmi.
3. Status tsunami **hanya** dari BMKG/InaTEWS — aplikasi tidak pernah
   mendeklarasikan tsunami sendiri.
