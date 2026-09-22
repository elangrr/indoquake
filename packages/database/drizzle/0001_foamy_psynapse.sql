CREATE TABLE "alert_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"target" text NOT NULL,
	"min_magnitude" real DEFAULT 4.5 NOT NULL,
	"max_distance_km" real,
	"province_slug" text,
	"tsunami_only" boolean DEFAULT false NOT NULL,
	"felt_only" boolean DEFAULT false NOT NULL,
	"location_latitude" double precision,
	"location_longitude" double precision,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "alert_subscriptions_channel_target_idx" ON "alert_subscriptions" USING btree ("channel","target");