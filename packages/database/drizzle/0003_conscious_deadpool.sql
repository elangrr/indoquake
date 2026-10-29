-- R137: runs inside the migrator's single transaction; the xact lock serialises concurrent runners
-- (same key as MIGRATION_LOCK_KEY in src/migrate.ts) and every statement is idempotent. Additive only: no data updates
-- here; the worker backfill fills the new columns (region_version < ASSIGNMENT_VERSION).
SELECT pg_advisory_xact_lock(7133001);--> statement-breakpoint
ALTER TABLE "earthquakes" ADD COLUMN IF NOT EXISTS "area_kind" text;--> statement-breakpoint
ALTER TABLE "earthquakes" ADD COLUMN IF NOT EXISTS "nearest_province_slug" text;--> statement-breakpoint
ALTER TABLE "earthquakes" ADD COLUMN IF NOT EXISTS "nearest_province_km" integer;--> statement-breakpoint
ALTER TABLE "earthquakes" ADD COLUMN IF NOT EXISTS "region_version" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "earthquakes_near_province_time_idx" ON "earthquakes" USING btree ("nearest_province_slug","event_time_utc");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "earthquakes_sea_time_idx" ON "earthquakes" USING btree ("event_time_utc") WHERE "earthquakes"."area_kind" = 'sea';
