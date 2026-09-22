import { createDb, type Database } from "@indoquake/database";

const globalForDb = globalThis as unknown as {
  indoquakeDb?: ReturnType<typeof createDb>;
};

export function getDb(): Database {
  if (!globalForDb.indoquakeDb) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL belum diset");
    }
    globalForDb.indoquakeDb = createDb(databaseUrl);
  }
  return globalForDb.indoquakeDb.db;
}
