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

// National seed (R137 AC 42): 17 fixed places in all 7 island groups, 13 land provinces, 10 of 17 in WITA/WIT,
// 3 sea places. Each place carries the literal server assignment of its exact coordinates (no jitter), checked
// against assignArea by scripts/seed.test.ts. [place, direction, lat, lon, kind, provinceSlug | nearestSlug, km]
export const REGIONS = [
  ["Kab. Pidie", "Tenggara", 5.3, 95.9, "land", "aceh", null],
  ["Kota Padang", "Barat", -0.9471, 100.4172, "land", "sumatera-barat", null],
  ["Kota Bengkulu", "BaratDaya", -3.7928, 102.2608, "land", "bengkulu", null],
  ["Kab. Sukabumi", "BaratDaya", -7.85, 106.25, "sea", "jawa-barat", 55],
  ["Kab. Wonosobo", "TimurLaut", -7.25, 109.94, "land", "jawa-tengah", null],
  ["Kab. Pacitan", "Selatan", -9.21, 111.05, "sea", "jawa-timur", 103],
  ["Kota Denpasar", "Selatan", -8.6705, 115.2126, "land", "bali", null],
  ["Kota Mataram", "Timur", -8.5833, 116.1167, "land", "nusa-tenggara-barat", null],
  ["Kota Kupang", "TimurLaut", -10.12, 123.66, "land", "nusa-tenggara-timur", null],
  ["Kota Samarinda", "Utara", -0.5022, 117.1536, "land", "kalimantan-timur", null],
  ["Kota Palu", "Timur", -0.95, 119.95, "land", "sulawesi-tengah", null],
  ["Kota Manado", "Selatan", 1.4748, 124.8421, "land", "sulawesi-utara", null],
  ["Kab. Maluku Tengah", "Tenggara", -5.5, 129.0, "sea", "maluku", 127],
  ["Kota Ternate", "Barat", 0.7898, 127.3764, "land", "maluku-utara", null],
  ["Kota Jayapura", "BaratDaya", -2.6, 140.67, "land", "papua", null],
  ["Kota Sorong", "Timur", -0.8762, 131.2558, "land", "papua-barat-daya", null],
  ["Kab. Merauke", "Utara", -8.4932, 140.4018, "land", "papua-selatan", null],
];

/** Pure rows for `count` quakes over the last 30 days; deterministic for a given count and `now`. */
export function seedRows(count, now = Date.now()) {
  return Array.from({ length: count }, (_, index) => {
    const [place, direction, latitude, longitude, kind, slug, km] = REGIONS[index % REGIONS.length];
    const at = new Date(now - index * 5.5 * 3_600_000 - 7 * 60_000);
    const magnitude = Math.round((2.6 + ((index * 37) % 34) / 10) * 10) / 10;
    return {
      event_key: (0x9a00000000000000n + BigInt(index) * 7919n).toString(16).padStart(16, "0").slice(-16),
      event_time_utc: at,
      event_time_wib: "",
      latitude,
      longitude,
      depth_km: 8 + ((index * 29) % 140),
      magnitude,
      region_name: `Pusat gempa berada di ${kind === "sea" ? "laut" : "darat"} ${20 + ((index * 11) % 120)} km ${direction} ${place}`,
      potential_text: "Tidak berpotensi tsunami",
      tsunami_potential: false,
      felt_text: magnitude >= 4.5 ? `III ${place.replace(/^(Kab\.|Kota) /, "")}` : null,
      shakemap_url: null,
      source: "BMKG",
      province_slug: kind === "land" ? slug : null,
      // R137 migration 0003 columns; dropped by seed() on a database without them (D10 baseline on da5356f).
      area_kind: kind,
      nearest_province_slug: kind === "sea" ? slug : null,
      nearest_province_km: kind === "sea" ? km : null,
      region_version: 1,
    };
  });
}

const COLUMNS_0003 = ["area_kind", "nearest_province_slug", "nearest_province_km", "region_version"];

/** Seeds `count` quakes; inserts the 0003 columns only when the schema has them (same seed on old and new trees). */
export async function seed(databaseUrl, count = 120) {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { max: 1 });
  const present = await sql`select column_name from information_schema.columns where table_name = 'earthquakes' and column_name = 'area_kind'`;
  const rows = seedRows(count).map((row) =>
    present.length > 0 ? row : Object.fromEntries(Object.entries(row).filter(([key]) => !COLUMNS_0003.includes(key))),
  );
  await sql`insert into earthquakes ${sql(rows)}`;
  await sql.end();
  return rows.map((row) => row.event_key);
}
