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
If an `indoquake-prod_indoquake_prod_pgdata` volume already exists and holds data, dump it first with
`pg_dump -U indoquake indoquake` run inside the postgres service (compose `exec -T postgres`), gzipped into
/opt/indoquake-prod/backup-<timestamp>.sql.gz.

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

## Rollback
Stop the stack with compose `down` (same `-f deploy/compose.prod.yml --env-file .env`; volumes are kept),
remove the indoquake.indonode.net.conf link from sites-enabled, `nginx -t`, reload nginx.
