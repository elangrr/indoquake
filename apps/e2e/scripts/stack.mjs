// Real PostGIS + Redis through Testcontainers for the `full` e2e project and e2e:serve.
// Without a container runtime it reports `unavailable` so callers can print SKIP.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, "..", "..", "..");
const POSTGIS_IMAGE = process.env.E2E_POSTGIS_IMAGE ?? "postgis/postgis:17-3.5";
const REDIS_IMAGE = process.env.E2E_REDIS_IMAGE ?? "redis:8-alpine";

export async function dockerAvailable() {
  try {
    const { getContainerRuntimeClient } = await import("testcontainers");
    await getContainerRuntimeClient();
    return true;
  } catch {
    return false;
  }
}

export async function startStack() {
  const { GenericContainer, Wait } = await import("testcontainers");
  const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
  const [pg, redis] = await Promise.all([
    new PostgreSqlContainer(POSTGIS_IMAGE).withDatabase("indoquake").withUsername("indoquake").withPassword("e2e-only").start(),
    new GenericContainer(REDIS_IMAGE).withExposedPorts(6379).withWaitStrategy(Wait.forLogMessage("Ready to accept connections")).start(),
  ]);
  const databaseUrl = pg.getConnectionUri();
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
  return {
    databaseUrl,
    redisUrl,
    async stop() {
      await Promise.allSettled([pg.stop(), redis.stop()]);
    },
  };
}

export async function migrate(databaseUrl) {
  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate: run } = await import("drizzle-orm/postgres-js/migrator");
  const sql = postgres(databaseUrl, { max: 1 });
  await run(drizzle(sql), { migrationsFolder: join(REPO_ROOT, "packages", "database", "drizzle") });
  await sql.end();
}

const REGIONS = [
  ["Kab. Sukabumi", "BaratDaya", -7.3, 106.6, "jawa-barat"],
  ["Kab. Garut", "Selatan", -7.6, 107.8, "jawa-barat"],
  ["Kab. Cilacap", "BaratDaya", -7.9, 108.9, "jawa-tengah"],
  ["Kab. Malang", "BaratDaya", -8.6, 112.4, "jawa-timur"],
  ["Kab. Pacitan", "Selatan", -8.8, 111.1, "jawa-timur"],
  ["Bantul", "BaratDaya", -8.0, 110.3, "di-yogyakarta"],
  ["Kab. Pandeglang", "BaratLaut", -6.5, 105.8, "banten"],
  ["Kab. Banyuwangi", "Tenggara", -8.6, 114.4, "jawa-timur"],
];

/** Seeds `count` quakes spread over the last 30 days; deterministic for a given count. */
export async function seed(databaseUrl, count = 120) {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { max: 1 });
  const now = Date.now();
  const rows = Array.from({ length: count }, (_, index) => {
    const [place, direction, lat, lon, provinceSlug] = REGIONS[index % REGIONS.length];
    const at = new Date(now - index * 5.5 * 3_600_000 - 7 * 60_000);
    const magnitude = Math.round((2.6 + ((index * 37) % 34) / 10) * 10) / 10;
    const offset = ((index * 13) % 40) / 100;
    return {
      event_key: (0x9a00000000000000n + BigInt(index) * 7919n).toString(16).padStart(16, "0").slice(-16),
      event_time_utc: at,
      event_time_wib: "",
      latitude: lat - offset,
      longitude: lon + offset,
      depth_km: 8 + ((index * 29) % 140),
      magnitude,
      region_name: `Pusat gempa berada di laut ${20 + ((index * 11) % 120)} km ${direction} ${place}`,
      potential_text: "Tidak berpotensi tsunami",
      tsunami_potential: false,
      felt_text: magnitude >= 4.5 ? `III ${place.replace("Kab. ", "")}` : null,
      shakemap_url: null,
      source: "BMKG",
      province_slug: provinceSlug,
    };
  });
  await sql`insert into earthquakes ${sql(rows)}`;
  await sql.end();
  return rows.map((row) => row.event_key);
}
