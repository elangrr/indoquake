# Indoquake host steps (draft; the merge card finalises, Rocky runs them)

Target: this VPS, Docker, behind the existing nginx with certbot, at https://indoquake.indonode.net (DECISIONS D1-D4).
Scope: indoquake containers, one NEW nginx vhost file, one DNS record. Never touch node services, their users,
units, ports, keys or data, the old indoquake stack or its volumes, or any other site's vhost.

## 0. Preflight (stop on any failure)
```sh
df -h "$(docker info --format '{{.DockerRootDir}}')"   # stop if less than 10 GB free
nproc; free -m                                           # headroom for 4 CPU / 4 GB of caps
docker ps -a                                             # note what runs; leave everything else alone
docker volume ls | grep indoquake                        # old stack volumes stay untouched
```
If an `indoquake-prod_indoquake_prod_pgdata` volume already exists and holds data, this is an upgrade: follow
"Upgrade (existing stack)" below instead of steps 1 to 3.

## 1. Code
Unpack a `git archive` of the pushed sha into /opt/indoquake-prod (root-owned tree, no .git).

## 2. Secrets (never printed, never committed)
In /opt/indoquake-prod, create the env file from deploy/env.example with mode 600 and fill POSTGRES_PASSWORD and
REDIS_PASSWORD with the output of `openssl rand -hex 24` each, written straight into the file.

## 3. Start
```sh
docker compose -f deploy/compose.prod.yml --env-file .env up -d --build
docker compose -f deploy/compose.prod.yml --env-file .env ps        # migrate exited 0; others healthy
curl -fsS http://127.0.0.1:3410/api/v1/health                        # 200, data.state fresh within a minute
```

## 4. nginx vhost (new file only)
Copy `deploy/nginx/indoquake.indonode.net.conf.template` into nginx's sites-available as
`indoquake.indonode.net.conf`, link it into sites-enabled, then `nginx -t` and reload nginx.

## 5. DNS (Rocky or Elang at the registrar)
A record `indoquake` for indonode.net pointing at this VPS. Wait until it resolves:
```sh
dig +short indoquake.indonode.net        # must print the VPS address before certbot
```

## 6. TLS
```sh
certbot certonly --nginx --dry-run -d indoquake.indonode.net   # must pass first
certbot --nginx -d indoquake.indonode.net
```
Then `nginx -t` and reload nginx.

## 7. Public checks
```sh
curl -fsSI https://indoquake.indonode.net/ | head -1                     # 200
curl -fsS https://indoquake.indonode.net/api/v1/health                  # status ok
curl -sN --max-time 20 https://indoquake.indonode.net/api/v1/stream     # retry, ready, status, ping within 15 s
```

## Upgrade (existing stack, e.g. R137: migration 0003 + region backfill)

All commands from /opt/indoquake-prod with `C="docker compose -f deploy/compose.prod.yml --env-file .env"`. Never print .env.

U1. Keep the previous tree and images (rollback material):
```sh
umask 077; mkdir -p backups; TS=$(date -u +%Y%m%dT%H%M%SZ)
tar -czf backups/tree-$TS.tar.gz --exclude=./backups --exclude=./.env .
docker image tag indoquake-prod-worker:latest indoquake-prod-worker:prev
docker image tag indoquake-prod-web:latest indoquake-prod-web:prev
```
U2. Dump BEFORE the new stack's migrate runs (custom format, D26), then verify it:
```sh
$C exec -T postgres pg_dump -U indoquake -Fc indoquake > backups/indoquake-$TS.dump
test -s backups/indoquake-$TS.dump                                                   # size > 0
$C exec -T postgres pg_restore --list < backups/indoquake-$TS.dump | grep -c "TABLE DATA"   # > 0, no error
```
U3. New code and images, nothing restarted yet: unpack a `git archive` of the pushed sha over /opt/indoquake-prod
(keeps .env and backups/), then `$C build`. The running containers keep their old images.

U4. Rehearsal on a throwaway postgres from the U2 dump (D24d; no published ports, internal network, removed after):
```sh
docker network create --internal iq-rehearsal
docker run -d --name iq-rehearsal-pg --network iq-rehearsal -e POSTGRES_USER=indoquake -e POSTGRES_DB=indoquake \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgis/postgis:18-3.6-alpine
until docker exec iq-rehearsal-pg pg_isready -h 127.0.0.1 -U indoquake; do sleep 2; done
docker exec -i iq-rehearsal-pg pg_restore -U indoquake -d indoquake --no-owner < backups/indoquake-$TS.dump
R="-e DATABASE_URL=postgres://indoquake@iq-rehearsal-pg:5432/indoquake -e REDIS_URL=redis://iq-rehearsal-none:6379"
docker run --rm --network iq-rehearsal $R indoquake-prod-worker migrate        # exit 0
docker run -d --name iq-rehearsal-worker --network iq-rehearsal $R indoquake-prod-worker
docker logs -f iq-rehearsal-worker 2>&1 | grep -m1 province_backfill_done      # scanned, updated, remaining 0, time
docker exec iq-rehearsal-pg psql -U indoquake -d indoquake -tAc "select count(*) from earthquakes where region_version < 1"   # 0
docker rm -f iq-rehearsal-worker iq-rehearsal-pg; docker network rm iq-rehearsal
```
Record the backfill duration (worker_started to province_backfill_done) and remaining = 0. Stop here if either fails.

U5. Deploy: `$C up -d`. Compose runs migrate first; web and worker start only after it exits 0 (depends_on
service_completed_successfully); the worker then runs the backfill before it polls. Then:
```sh
$C ps -a migrate                                                  # Exited (0)
curl -fsS http://127.0.0.1:3410/api/v1/health                     # 200 within 5 min
$C logs worker | grep province_backfill_done                      # remaining 0
$C exec -T postgres psql -U indoquake -d indoquake -tAc "select count(*) from earthquakes where region_version < 1"   # 0
```
U6. Public checks: section 7, plus /api/v1/area?lat=-2.5337&lon=140.7181 answers zone WIT and provinceSlug papua.

Rollback triggers (any one; D26): migrate exits non-zero; health is not 200 within 5 min; the backfill logs an error,
or remaining > 0 15 min after start; a public check fails. Stop switch for the backfill alone: REGION_BACKFILL=off
in .env, then `$C up -d worker` (logs province_backfill_skipped).

Rollback (code only, the default): the schema change is additive, so the previous code runs on it.
```sh
tar -xzf backups/tree-$TS.tar.gz                                  # previous tree back over the new one (.env kept)
docker image tag indoquake-prod-worker:prev indoquake-prod-worker:latest
docker image tag indoquake-prod-web:prev indoquake-prod-web:latest
$C up -d --no-build
```
Restore the database ONLY with Elang's explicit yes (hard stop, never by default): `$C stop web worker`, then
`$C exec -T postgres pg_restore -U indoquake -d indoquake --clean --if-exists --single-transaction < backups/indoquake-$TS.dump`,
then start the previous tree as above.

## Rollback
Stop the stack with compose `down` (same `-f deploy/compose.prod.yml --env-file .env`; volumes are kept),
remove the indoquake.indonode.net.conf link from sites-enabled, `nginx -t`, reload nginx.
