import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER, runMigrations } from "../src/migrate";
import { startPostgis, type StartedPostgis } from "../test-support/containers";

let pg: StartedPostgis;

beforeEach(async () => {
  pg = await startPostgis();
});
afterEach(async () => {
  await pg.stop();
});

function migrationsUpTo(count: number): string {
  const dir = mkdtempSync(join(tmpdir(), `migrations-${count}-`));
  cpSync(MIGRATIONS_FOLDER, dir, { recursive: true });
  const journalPath = join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
  journal.entries = journal.entries.slice(0, count);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

async function query(text: string): Promise<unknown[]> {
  const client = postgres(pg.url, { max: 1 });
  try {
    return [...(await client.unsafe(text))];
  } finally {
    await client.end();
  }
}

describe("migrations (A-19, D16)", () => {
  it("apply on an empty PostGIS database and a second run is a no-op", async () => {
    await runMigrations(pg.url);
    await runMigrations(pg.url);
    expect(await query("select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual([{ n: 4 }]);
    expect(await query("select count(*)::int as n from event_log")).toEqual([{ n: 0 }]);
  });

  it("two concurrent runners apply each migration once", async () => {
    await Promise.all([runMigrations(pg.url), runMigrations(pg.url)]);
    expect(await query("select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual([{ n: 4 }]);
  });

  it("upgrade a database at 0001 with rows and keep the rows", async () => {
    await runMigrations(pg.url, migrationsUpTo(2));
    await query(
      "insert into earthquakes (event_key, event_time_utc, event_time_wib, latitude, longitude, depth_km, magnitude, region_name) " +
        "values ('0123456789abcdef', now(), 'x', -7.2, 107.6, 10, 4.2, 'Bandung')",
    );
    await runMigrations(pg.url);
    expect(await query("select event_key, province_slug from earthquakes")).toEqual([
      { event_key: "0123456789abcdef", province_slug: null },
    ]);
  });

  it("0003 on a database at 0002 with rows adds 4 columns and 2 indexes and keeps every value (AC 13)", async () => {
    await runMigrations(pg.url, migrationsUpTo(3));
    await query(
      "insert into earthquakes (event_key, event_time_utc, event_time_wib, latitude, longitude, depth_km, magnitude, region_name, province_slug) " +
        "values ('0123456789abcdef', '2026-10-27T16:30:00Z', 'x', -7.2, 107.6, 10, 4.2, 'Bandung', 'jawa-barat'), " +
        "('fedcba9876543210', '2026-10-27T17:30:00Z', 'y', -9.5, 110.0, 20, 5.1, 'Selatan Jawa', 'di-yogyakarta')",
    );
    await runMigrations(pg.url);
    await runMigrations(pg.url);
    expect(
      await query(
        "select event_key, province_slug, region_name, area_kind, nearest_province_slug, nearest_province_km, region_version " +
          "from earthquakes order by event_key",
      ),
    ).toEqual([
      { event_key: "0123456789abcdef", province_slug: "jawa-barat", region_name: "Bandung", area_kind: null, nearest_province_slug: null, nearest_province_km: null, region_version: 0 },
      { event_key: "fedcba9876543210", province_slug: "di-yogyakarta", region_name: "Selatan Jawa", area_kind: null, nearest_province_slug: null, nearest_province_km: null, region_version: 0 },
    ]);
    expect(
      await query(
        "select indexname from pg_indexes where tablename = 'earthquakes' and indexname in " +
          "('earthquakes_near_province_time_idx', 'earthquakes_sea_time_idx', 'earthquakes_province_time_idx') order by indexname",
      ),
    ).toEqual([
      { indexname: "earthquakes_near_province_time_idx" },
      { indexname: "earthquakes_province_time_idx" },
      { indexname: "earthquakes_sea_time_idx" },
    ]);
    expect(await query("select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual([{ n: 4 }]);
  });

  it("two concurrent runners from 0002 apply 0003 once and end in the same state as one run (AC 13)", async () => {
    await runMigrations(pg.url, migrationsUpTo(3));
    await Promise.all([runMigrations(pg.url), runMigrations(pg.url)]);
    expect(await query("select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual([{ n: 4 }]);
    expect(
      await query(
        "select column_name, data_type, is_nullable, column_default from information_schema.columns " +
          "where table_name = 'earthquakes' and column_name in ('area_kind', 'nearest_province_slug', 'nearest_province_km', 'region_version') " +
          "order by column_name",
      ),
    ).toEqual([
      { column_name: "area_kind", data_type: "text", is_nullable: "YES", column_default: null },
      { column_name: "nearest_province_km", data_type: "integer", is_nullable: "YES", column_default: null },
      { column_name: "nearest_province_slug", data_type: "text", is_nullable: "YES", column_default: null },
      { column_name: "region_version", data_type: "smallint", is_nullable: "NO", column_default: "0" },
    ]);
  });
});
