import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import { createDb } from "../src/client";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL belum diisi di .env");
  process.exit(1);
}

const { sql: client, db } = createDb(databaseUrl);

const tables = await db.execute(
  sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
);
console.log(
  "Tabel:",
  tables.map((row) => String((row as { table_name: unknown }).table_name)).join(", "),
);

const counts = await db.execute(
  sql`select count(*)::int as count from earthquakes`,
);
console.log(
  "Jumlah gempa:",
  (counts[0] as { count: number } | undefined)?.count ?? 0,
);

await client.end();
