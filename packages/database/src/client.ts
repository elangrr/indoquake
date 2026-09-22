import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 10 });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

export type Database = ReturnType<typeof createDb>["db"];
