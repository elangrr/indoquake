CREATE TABLE "earthquake_feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"earthquake_id" integer NOT NULL,
	"feed" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earthquake_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"earthquake_id" integer NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earthquakes" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"event_time_utc" timestamp with time zone NOT NULL,
	"event_time_wib" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"depth_km" real NOT NULL,
	"magnitude" real NOT NULL,
	"region_name" text NOT NULL,
	"potential_text" text,
	"tsunami_potential" boolean,
	"felt_text" text,
	"shakemap_url" text,
	"source" text DEFAULT 'BMKG' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "earthquake_feeds" ADD CONSTRAINT "earthquake_feeds_earthquake_id_earthquakes_id_fk" FOREIGN KEY ("earthquake_id") REFERENCES "public"."earthquakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earthquake_updates" ADD CONSTRAINT "earthquake_updates_earthquake_id_earthquakes_id_fk" FOREIGN KEY ("earthquake_id") REFERENCES "public"."earthquakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "earthquake_feeds_unique_idx" ON "earthquake_feeds" USING btree ("earthquake_id","feed");--> statement-breakpoint
CREATE UNIQUE INDEX "earthquakes_event_key_idx" ON "earthquakes" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "earthquakes_event_time_idx" ON "earthquakes" USING btree ("event_time_utc");--> statement-breakpoint
CREATE INDEX "earthquakes_magnitude_idx" ON "earthquakes" USING btree ("magnitude");