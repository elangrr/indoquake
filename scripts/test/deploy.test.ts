import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const DEPLOY = join(import.meta.dirname, "..", "..", "deploy");
const composeText = readFileSync(join(DEPLOY, "compose.prod.yml"), "utf8");
type Service = Record<string, unknown> & { deploy?: { resources: { limits: { cpus: string; memory: string } } } };
const compose = parse(composeText, { merge: true }) as {
  name: string;
  services: Record<string, Service>;
  networks: Record<string, { internal?: boolean }>;
  volumes: Record<string, unknown>;
};
const nginx = readFileSync(join(DEPLOY, "nginx", "indoquake.indonode.net.conf.template"), "utf8");
const service = (name: string): Service => compose.services[name] as Service;
const limits = (name: string) => service(name).deploy?.resources.limits;
const READY = {
  migrate: { condition: "service_completed_successfully" },
  postgres: { condition: "service_healthy" },
  redis: { condition: "service_healthy" },
};

describe("deploy/compose.prod.yml (A-21, D3, D4, D15, D16)", () => {
  it("has the five services under a new project name", () => {
    expect(compose.name).toBe("indoquake-prod");
    expect(Object.keys(compose.services).sort()).toEqual(["migrate", "postgres", "redis", "web", "worker"]);
  });

  it("publishes only 127.0.0.1:3410 to web:3000", () => {
    expect(service("web").ports).toEqual(["127.0.0.1:3410:3000"]);
    expect(["postgres", "redis", "worker", "migrate"].map((name) => service(name).ports)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("caps the long-running services exactly as D4 (4 CPU / 4 GiB in total)", () => {
    expect(["web", "worker", "postgres", "redis"].map(limits)).toEqual([
      { cpus: "1.5", memory: "1g" },
      { cpus: "0.5", memory: "512m" },
      { cpus: "1.5", memory: "2g" },
      { cpus: "0.5", memory: "512m" },
    ]);
  });

  it("runs migrate once (worker image, 0.5 CPU / 256 MB, restart no) before web and worker", () => {
    expect(service("migrate")).toMatchObject({ image: "indoquake-prod-worker", command: ["migrate"], restart: "no" });
    expect(limits("migrate")).toEqual({ cpus: "0.5", memory: "256m" });
    expect([service("web").depends_on, service("worker").depends_on]).toEqual([READY, READY]);
  });

  it("caps container logs at 3 x 10 MB on every service", () => {
    const logging = { driver: "json-file", options: { "max-size": "10m", "max-file": "3" } };
    expect(Object.values(compose.services).map((entry) => entry.logging)).toEqual([logging, logging, logging, logging, logging]);
  });

  it("has healthchecks for postgres, redis and web", () => {
    expect(["postgres", "redis", "web"].map((name) => typeof service(name).healthcheck)).toEqual(["object", "object", "object"]);
  });

  it("checks postgres readiness over TCP with a start period (A-M1)", () => {
    expect(service("postgres").healthcheck).toMatchObject({
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U indoquake -d indoquake"],
      start_period: "60s",
    });
  });

  it("runs redis as the image's redis user, not root (D4, A-L1)", () => {
    expect(service("redis").user).toBe("redis");
  });

  it("keeps postgres and redis on the internal network only", () => {
    expect(compose.networks.internal).toEqual({ internal: true });
    expect([service("postgres").networks, service("redis").networks]).toEqual([["internal"], ["internal"]]);
  });

  it("uses no host network, no bind mounts and new volume names", () => {
    expect(composeText).not.toMatch(/network_mode/);
    expect([service("postgres").volumes, service("redis").volumes]).toEqual([
      ["indoquake_prod_pgdata:/var/lib/postgresql"],
      ["indoquake_prod_redisdata:/data"],
    ]);
    expect(Object.keys(compose.volumes)).toEqual(["indoquake_prod_pgdata", "indoquake_prod_redisdata"]);
    expect(composeText).not.toContain("indoquake_pgdata");
  });

  it("restarts long-running services unless stopped and runs app containers as non-root", () => {
    expect(["web", "worker", "postgres", "redis"].map((name) => service(name).restart)).toEqual([
      "unless-stopped",
      "unless-stopped",
      "unless-stopped",
      "unless-stopped",
    ]);
    expect(["web", "worker", "migrate"].map((name) => service(name).user)).toEqual(["1000:1000", "1000:1000", "1000:1000"]);
  });

  it("takes every secret from the environment", () => {
    expect(composeText).toContain("${POSTGRES_PASSWORD:?");
    expect(composeText).toContain("${REDIS_PASSWORD:?");
    expect(composeText).not.toMatch(/PASSWORD:\s+[^$\s]/);
  });
});

describe("deploy/nginx template (A-22, D18, D19)", () => {
  const stream = nginx.slice(nginx.indexOf("location /api/v1/stream"), nginx.indexOf("location / {"));

  it("serves exactly indoquake.indonode.net without default_server", () => {
    expect(nginx.match(/server_name [^;]+;/g)).toEqual(["server_name indoquake.indonode.net;"]);
    expect(nginx).not.toContain("default_server");
  });

  it("proxies to 127.0.0.1:3410 only", () => {
    expect(new Set(nginx.match(/proxy_pass [^;]+;/g))).toEqual(new Set(["proxy_pass http://127.0.0.1:3410;"]));
  });

  it.each([
    "proxy_buffering off;",
    "proxy_cache off;",
    "gzip off;",
    "proxy_http_version 1.1;",
    'proxy_set_header Connection "";',
    "proxy_read_timeout 3600s;",
  ])("streams SSE with %s", (directive) => {
    expect(stream).toContain(directive);
  });

  it("overwrites X-Real-IP and X-Forwarded-For with $remote_addr in both locations", () => {
    expect(nginx.match(/proxy_set_header X-Real-IP \$remote_addr;/g)).toHaveLength(2);
    expect(nginx.match(/proxy_set_header X-Forwarded-For \$remote_addr;/g)).toHaveLength(2);
  });

  it("rate limits with an indoquake-prefixed zone", () => {
    expect([nginx.includes("zone=indoquake_req:10m"), nginx.includes("limit_req zone=indoquake_req")]).toEqual([true, true]);
  });
});
