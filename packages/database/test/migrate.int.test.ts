import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER, runMigrations } from "../src";
import { startPostgis, type StartedPostgis } from "../test-support/containers";

let pg: StartedPostgis;

beforeEach(async () => {
  pg = await startPostgis();
});
afterEach(async () => {
  await pg.stop();
});

function migrationsUpTo0001(): string {
  const dir = mkdtempSync(join(tmpdir(), "migrations-0001-"));
  cpSync(MIGRATIONS_FOLDER, dir, { recursive: true });
  const journalPath = join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
  journal.entries = journal.entries.slice(0, 2);
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
    expect(await query("select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual([{ n: 3 }]);
    expect(await query("select count(*)::int as n from event_log")).toEqual([{ n: 0 }]);
  });

  it("two concurrent runners apply each migration once", async () => {
    await Promise.all([runMigrations(pg.url), runMigrations(pg.url)]);
    expect(await query("select count(*)::int as n from drizzle.__drizzle_migrations")).toEqual([{ n: 3 }]);
  });

  it("upgrade a database at 0001 with rows and keep the rows", async () => {
    await runMigrations(pg.url, migrationsUpTo0001());
    await query(
      "insert into earthquakes (event_key, event_time_utc, event_time_wib, latitude, longitude, depth_km, magnitude, region_name) " +
        "values ('0123456789abcdef', now(), 'x', -7.2, 107.6, 10, 4.2, 'Bandung')",
    );
    await runMigrations(pg.url);
    expect(await query("select event_key, province_slug from earthquakes")).toEqual([
      { event_key: "0123456789abcdef", province_slug: null },
    ]);
  });
});
