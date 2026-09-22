import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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

export const earthquakeUpdates = pgTable("earthquake_updates", {
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
});

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
