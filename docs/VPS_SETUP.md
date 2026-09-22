# Setup VPS — Indoquake

Dokumen ini mencatat setup nyata yang sudah dilakukan di VPS produksi.

## Kondisi VPS

- OS: Ubuntu 24.04 LTS
- Docker Engine + Compose plugin v2.35.1 (sudah terpasang, dipakai service lain)
- Nginx aktif di port 80/443 (dipakai service lain — jangan diapa-apakan)
- UFW aktif dengan default deny (tidak diubah untuk Indoquake)
- Service lain yang berjalan: Espresso node, Subsquid worker, dll (tidak disentuh)

## Stack database Indoquake

Lokasi: `/opt/indoquake/`

| Komponen | Image | Port (bind) | Limit RAM |
| --- | --- | --- | --- |
| PostgreSQL + PostGIS 3.4 | `postgis/postgis:16-3.4` | `127.0.0.1:55432` → 5432 | 2 GB |
| Redis 7 | `redis:7-alpine` | `127.0.0.1:56379` → 6379 | 512 MB |

- Project Docker: `indoquake` (network & volume terpisah dari service lain)
- Volume: `indoquake_pgdata`, `indoquake_redisdata`
- Kredensial: `/opt/indoquake/.env` (chmod 600, tidak di-commit)
- Database: `indoquake_dev` (development) dan `indoquake_prod` (produksi)
- Ekstensi PostGIS 3.4 sudah aktif di kedua database
- Port **tidak pernah dibuka ke internet** — hanya localhost VPS

## Perintah operasional

```bash
cd /opt/indoquake
docker compose ps          # status
docker compose up -d       # start
docker compose logs -f postgres
docker exec indoquake-postgres psql -U indoquake -d indoquake_dev
```

## SSH tunnel (dari Windows dev)

```powershell
& "C:\Program Files\PuTTY\plink.exe" -i "C:\Users\admin\Documents\priv hetzner.ppk" `
  -N -L 55432:127.0.0.1:55432 -L 56379:127.0.0.1:56379 root@116.202.218.189
```

- Jendela tunnel dibiarkan terbuka selama sesi dev.
- Setelah tunnel jalan, `.env` lokal memakai `127.0.0.1:55432` / `127.0.0.1:56379`.

## TODO (Fase 10)

- [ ] Backup harian `pg_dump` via cron + retensi 14 hari
- [ ] Nginx server block + HTTPS (Certbot) untuk aplikasi web
- [ ] Container web + worker di compose produksi
- [ ] Monitoring & alerting
