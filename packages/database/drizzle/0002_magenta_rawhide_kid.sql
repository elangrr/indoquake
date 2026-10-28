-- R133: runs inside the migrator's single transaction; the xact lock serialises concurrent runners
-- (same key as MIGRATION_LOCK_KEY in src/migrate.ts) and every statement is idempotent.
SELECT pg_advisory_xact_lock(7133001);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "earthquakes" ADD COLUMN IF NOT EXISTS "province_slug" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_log_created_idx" ON "event_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "earthquake_updates_eq_time_idx" ON "earthquake_updates" USING btree ("earthquake_id","observed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "earthquakes_province_time_idx" ON "earthquakes" USING btree ("province_slug","event_time_utc");
