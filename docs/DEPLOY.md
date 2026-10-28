# Menjalankan dan men-deploy Indoquake

## Pengembangan lokal

Butuh Node 20.9+ (image produksi memakai Node 24 LTS), Postgres (image PostGIS) dan Redis lokal.

```sh
docker run -d --name iq-pg -e POSTGRES_USER=indoquake -e POSTGRES_PASSWORD="${DEV_DB_PASSWORD}" -e POSTGRES_DB=indoquake \
  -p 127.0.0.1:5432:5432 postgis/postgis:18-3.6-alpine
docker run -d --name iq-redis -p 127.0.0.1:6379:6379 redis:8.10.3-alpine
npm install
# isi DATABASE_URL dan REDIS_URL di .env (lihat deploy/env.example untuk semua variabel)
npm run env:sync
npm run migrate -w @indoquake/worker   # migrasi sekali
npm run dev:worker                     # poller BMKG
npm run dev                            # web di http://localhost:3000
```

`npm start -w @indoquake/worker -- --once` mem-poll tiap feed sekali lalu keluar.

## Uji

```sh
bash scripts/gate.sh          # install, kontrak, typecheck, lint, unit test, build, cek repo publik; baris akhir GATE PASS
bash scripts/gate.sh --int    # Testcontainers PostGIS + Redis; tanpa Docker: "SKIP: docker unavailable"
REQUIRE_DOCKER=1 npm run test:int   # keluar 2 bila Docker tidak ada
bash scripts/gate.sh --e2e    # Playwright (workspace @indoquake/e2e)
```

GATE_INSTALL=ci (bawaan), install atau skip. NEXT_BUILD_CPUS membatasi worker build Next (bawaan gate: 4).

## Produksi

Satu VPS, Docker Compose, di belakang nginx dan certbot (deploy/compose.prod.yml):

| Layanan | Batas | Port |
| --- | --- | --- |
| web | 1,5 CPU / 1 GiB | 127.0.0.1:3410 saja |
| worker | 0,5 CPU / 512 MiB | tidak ada |
| postgres | 1,5 CPU / 2 GiB | tidak ada (jaringan internal) |
| redis | 0,5 CPU / 512 MiB | tidak ada (jaringan internal) |
| migrate (sekali jalan) | 0,5 CPU / 256 MiB | tidak ada |

- `migrate` menjalankan migrasi lalu keluar; web dan worker baru mulai setelah migrate sukses dan postgres/redis sehat.
- Log tiap kontainer dibatasi 3 x 10 MB. Gempa disimpan selamanya; event_log dipangkas setelah 72 jam.
- Rahasia hanya dari file env di host (POSTGRES_PASSWORD, REDIS_PASSWORD), tidak pernah di repo.
- nginx: deploy/nginx/indoquake.indonode.net.conf.template (stream tanpa buffer, X-Real-IP dari `$remote_addr`).
- Langkah host lengkap: deploy/HOST_STEPS.draft.md.
