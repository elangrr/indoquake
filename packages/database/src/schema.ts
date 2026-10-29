import {
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const earthquakes = pgTable(
  "earthquakes",
  {
    id: serial("id").primaryKey(),
    eventKey: text("event_key").notNull(),
    eventTimeUtc: timestamp("event_time_utc", { withTimezone: true }).notNull(),
    eventTimeWib: text("event_time_wib").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    depthKm: real("depth_km").notNull(),
    magnitude: real("magnitude").notNull(),
    regionName: text("region_name").notNull(),
    potentialText: text("potential_text"),
    tsunamiPotential: boolean("tsunami_potential"),
    feltText: text("felt_text"),
    shakemapUrl: text("shakemap_url"),
    source: text("source").notNull().default("BMKG"),
    // Containing province (land only). Sea events: null here, nearest province below (R137, migration 0003).
    provinceSlug: text("province_slug"),
    areaKind: text("area_kind"), // "land" | "sea"; null = legacy row not yet re-assigned
    nearestProvinceSlug: text("nearest_province_slug"),
    nearestProvinceKm: integer("nearest_province_km"),
    regionVersion: smallint("region_version").notNull().default(0), // ASSIGNMENT_VERSION of the stored assignment
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("earthquakes_event_key_idx").on(table.eventKey),
    index("earthquakes_event_time_idx").on(table.eventTimeUtc),
    index("earthquakes_magnitude_idx").on(table.magnitude),
    index("earthquakes_province_time_idx").on(table.provinceSlug, table.eventTimeUtc),
    index("earthquakes_near_province_time_idx").on(table.nearestProvinceSlug, table.eventTimeUtc),
    index("earthquakes_sea_time_idx").on(table.eventTimeUtc).where(sql`${table.areaKind} = 'sea'`),
  ],
);

export const earthquakeFeeds = pgTable(
  "earthquake_feeds",
  {
    id: serial("id").primaryKey(),
    earthquakeId: integer("earthquake_id")
      .notNull()
      .references(() => earthquakes.id, { onDelete: "cascade" }),
    feed: text("feed").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("earthquake_feeds_unique_idx").on(
      table.earthquakeId,
      table.feed,
    ),
  ],
);

export const earthquakeUpdates = pgTable(
  "earthquake_updates",
  {
    id: serial("id").primaryKey(),
    earthquakeId: integer("earthquake_id")
      .notNull()
      .references(() => earthquakes.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("earthquake_updates_eq_time_idx").on(table.earthquakeId, table.observedAt),
  ],
);

/** Outbox of announced changes; id is the SSE id / payload seq. Pruned by the worker (EVENT_LOG_RETENTION_HOURS). */
export const eventLog = pgTable(
  "event_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventKey: text("event_key").notNull(),
    type: text("type").$type<"new" | "updated">().notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("event_log_created_idx").on(table.createdAt)],
);

export const alertSubscriptions = pgTable(
  "alert_subscriptions",
  {
    id: serial("id").primaryKey(),
    channel: text("channel").notNull(),
    target: text("target").notNull(),
    minMagnitude: real("min_magnitude").notNull().default(4.5),
    maxDistanceKm: real("max_distance_km"),
    provinceSlug: text("province_slug"),
    tsunamiOnly: boolean("tsunami_only").notNull().default(false),
    feltOnly: boolean("felt_only").notNull().default(false),
    locationLatitude: doublePrecision("location_latitude"),
    locationLongitude: doublePrecision("location_longitude"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("alert_subscriptions_channel_target_idx").on(
      table.channel,
      table.target,
    ),
  ],
);
